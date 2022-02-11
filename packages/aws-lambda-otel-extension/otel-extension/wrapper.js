const { gzipSync } = require('zlib');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { InMemorySpanExporter } = require('@opentelemetry/sdk-trace-base');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { detectResources, envDetector, processDetector } = require('@opentelemetry/resources');
const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk');
const { getEnv } = require('@opentelemetry/core');
const { awsLambdaDetector } = require('@opentelemetry/resource-detector-aws');
const { AwsLambdaInstrumentation } = require('@opentelemetry/instrumentation-aws-lambda');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { diag, DiagConsoleLogger } = require('@opentelemetry/api');
const { logMessage } = require('./helper');
const SlsSpanProcessor = require('./span.processor');
const { detectEventType } = require('./eventDetection');

new ExpressInstrumentation();

let tracerProvider;
let memoryExporter;
let spanProcessor;

const eventData = {};
let timeoutHandler;
let transactionCount = 0;

const responseHandler = async (span, { res, err }, isTimeout) => {
  await tracerProvider.forceFlush();
  spanProcessor.finishAllSpans();
  const spans = memoryExporter.getFinishedSpans();

  let pathData;
  let functionData;
  if (span) {
    functionData = eventData[span.attributes['faas.execution']];
    pathData = {
      'http.path': functionData.httpPath,
    };
  } else {
    // Find data from unfinished spans
    pathData = spans.reduce(
      (obj, val) => {
        if (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-aws-lambda') {
          functionData = eventData[val.attributes['faas.execution']];
          return {
            'http.path': eventData[val.attributes['faas.execution']].httpPath,
          };
        }
        return obj;
      },
      { 'http.status_code': 500 }
    );
  }

  const { startTime: st, endTime: et } = spans.reduce(
    (obj, val) => {
      if (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-aws-lambda') {
        const startTime = val.startTime || [0, 0];
        const endTime = val.endTime || [0, 0];
        return {
          startTime: new Date((startTime[0] * 1000000000 + startTime[1]) / 1000000),
          endTime: new Date((endTime[0] * 1000000000 + endTime[1]) / 1000000),
        };
      }
      return obj;
    },
    { startTime: new Date(), endTime: new Date() }
  );

  functionData.startTime = st.getTime();
  functionData.endTime = et.getTime();

  functionData.error = false;
  functionData.timeout = isTimeout;
  if (isTimeout) {
    functionData.error = true;
    functionData.errorCulprit = 'timeout';
    functionData.errorExceptionType = 'TimeoutError';
    functionData.errorExceptionMessage = '';
    functionData.errorExceptionStacktrace = 'Function execution duration going to exceeded configured timeout limit.';
  } else if (err) {
    functionData.error = true;
    functionData.errorCulprit = err.message;
    functionData.errorExceptionType = typeof err;
    functionData.errorExceptionMessage = err.message;
    functionData.errorExceptionStacktrace = err.stack;
  }

  if (!err && !res) {
    pathData['http.status_code'] = 500;
  } else if (pathData) {
    let statusCode = (res || {}).statusCode || 200;
    if (err && !(res || {}).statusCode) {
      statusCode = 500;
    }
    pathData['http.status_code'] = statusCode;
  }

  const grouped = spans.reduce((obj, val) => {
    const key = `${val.instrumentationLibrary.name}-${val.instrumentationLibrary.version}`;
    if (!obj[key]) obj[key] = [];
    return {
      ...obj,
      [key]: [...obj[key], val],
    };
  }, {});

  // Check for express path
  pathData['http.path'] = spans.reduce((finalPath, val) => {
    if (
      val.instrumentationLibrary.name === '@opentelemetry/instrumentation-express' &&
      val.name === 'middleware - bound '
    ) {
      return val.attributes['http.route'];
    }
    return finalPath;
  }, pathData['http.path']);

  // Check for Koa path
  pathData['http.path'] = spans.reduce((finalPath, val) => {
    if (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-koa' && /router - /gi.test(val.name)) {
      return val.attributes['http.route'];
    }
    return finalPath;
  }, pathData['http.path']);

  functionData.httpPath = pathData['http.path'];
  functionData.httpStatusCode = pathData['http.status_code'];

  const data = Object.keys(grouped).map((key) => {
    const spanList = grouped[key];
    const firstThing = spanList[0];

    const spanObj = spanList
      .map((val) => {
        const { traceId, spanId } = val.spanContext();
        const startTime = val.startTime || [0, 0];
        const endTime = val.endTime || [0, 0];
        return {
          traceId,
          spanId,
          parentSpanId: val.parentSpanId,
          // This is a bug with the express instrumentation where the route handler
          // does not resolve until the lambda invocation is complete 🤷‍♂️
          name: val.name === 'middleware - bound ' ? `request handler - ${pathData['http.path']}` : val.name,
          kind: 'SPAN_KIND_SERVER',
          startTimeUnixNano: `${startTime[0] * 1000000000 + startTime[1]}`,
          endTimeUnixNano: `${endTime[0] * 1000000000 + endTime[1]}`,
          attributes: {
            ...val.attributes,
            ...pathData,
          },
          status: {},
        };
      })
      .reduce((obj, span) => {
        obj[span.spanId] = span;
        return obj;
      }, {});

    return {
      instrumentationLibrary: {
        name: firstThing.instrumentationLibrary.name,
        version: firstThing.instrumentationLibrary.version,
      },
      spans: Object.values(spanObj),
    };
  });

  logMessage(
    'Wrapper trace data: ',
    JSON.stringify(
      {
        function: functionData,
        traces: {
          resourceSpans: [
            {
              resource: tracerProvider.resource.attributes,
              instrumentationLibrarySpans: data,
            },
          ],
        },
      },
      null,
      2
    )
  );

  console.log(
    `SERVERLESS_ENTERPRISE ${JSON.stringify({
      c: true,
      b: gzipSync(
        JSON.stringify({
          function: functionData,
          traces: {
            resourceSpans: [
              {
                resource: tracerProvider.resource.attributes,
                instrumentationLibrarySpans: data,
              },
            ],
          },
        })
      ).toString('base64'),
      origin: 'sls-layer',
    })}`
  );

  // Reset the exporter so we don't see duplicates
  memoryExporter.reset();
};

const handleTimeouts = (remainingTime) => {
  const timeoutTime = remainingTime - 50;
  // const setTimeoutTime = Date.now();
  timeoutHandler = setTimeout(async () => {
    await responseHandler(null, {}, true);
  }, timeoutTime).unref();
};

const instrumentations = [
  getNodeAutoInstrumentations(),
  new AwsInstrumentation({
    suppressInternalInstrumentation: true,
  }),
  new AwsLambdaInstrumentation({
    disableAwsContextPropagation: true,
    requestHook: async (span, { event, context }) => {
      handleTimeouts(context.getRemainingTimeInMillis());

      const eventType = detectEventType(event);

      eventData[context.awsRequestId] = {
        ...tracerProvider.resource.attributes,
        computeCustomArn: context.invokedFunctionArn,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        computeRegion: process.env.AWS_REGION,
        computeRuntime: `aws.lambda.nodejs.${process.versions.node}`,
        computeCustomFunctionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        computeMemorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
        eventCustomXTraceId: process.env._X_AMZN_TRACE_ID,
        computeCustomLogStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
        computeCustomEnvArch: process.arch,
        eventType,
        eventCustomRequestId: context.awsRequestId,
        computeIsColdStart: ++transactionCount === 1,
        eventCustomDomain: null,
        eventCustomRequestTimeEpoch: null,
      };

      if (eventType === 'aws.apigateway.http') {
        eventData[context.awsRequestId].eventCustomApiId = event.requestContext.apiId;
        eventData[context.awsRequestId].eventSource = 'aws.apigateway';
        eventData[context.awsRequestId].eventCustomAccountId = event.requestContext.accountId;
        eventData[context.awsRequestId].httpPath = event.requestContext.resourcePath;
        eventData[context.awsRequestId].eventCustomHttpMethod = event.requestContext.httpMethod;
        eventData[context.awsRequestId].eventCustomDomain = event.requestContext.domainName;
        eventData[context.awsRequestId].eventCustomRequestTimeEpoch = event.requestContext.requestTimeEpoch;
      } else if (eventType === 'aws.apigatewayv2.http') {
        eventData[context.awsRequestId].eventCustomApiId = event.requestContext.apiId;
        eventData[context.awsRequestId].eventSource = 'aws.apigateway';
        eventData[context.awsRequestId].eventCustomAccountId = event.requestContext.accountId;
        const routeKey = event.requestContext.routeKey;
        const path = routeKey.split(' ')[1];
        eventData[context.awsRequestId].httpPath = path;
        eventData[context.awsRequestId].eventCustomHttpMethod = event.requestContext.http.method;
        eventData[context.awsRequestId].eventCustomDomain = event.requestContext.domainName;
        eventData[context.awsRequestId].eventCustomRequestTimeEpoch = event.requestContext.timeEpoch;
      }
    },
    responseHook: async (span, { err, res }) => {
      clearTimeout(timeoutHandler);
      await responseHandler(span, { err, res });
    },
  }),
];

const logLevel = getEnv().OTEL_LOG_LEVELl;
diag.setLogger(new DiagConsoleLogger(), logLevel);

// Register instrumentations synchronously to ensure code is patched even before provider is ready.
registerInstrumentations({
  instrumentations: instrumentations,
});

async function initializeProvider() {
  const resource = await detectResources({
    detectors: [awsLambdaDetector, envDetector, processDetector],
  });

  tracerProvider = new NodeTracerProvider({
    resource,
  });
  memoryExporter = new InMemorySpanExporter();
  spanProcessor = new SlsSpanProcessor(memoryExporter);
  tracerProvider.addSpanProcessor(spanProcessor);

  let sdkRegistrationConfig = {};
  tracerProvider.register(sdkRegistrationConfig);

  // Re-register instrumentation with initialized provider. Patched code will see the update.
  registerInstrumentations({
    instrumentations,
    tracerProvider,
  });
}

initializeProvider();
