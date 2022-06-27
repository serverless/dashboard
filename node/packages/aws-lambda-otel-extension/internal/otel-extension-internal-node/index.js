'use strict';

const processStartTime = process.hrtime.bigint();

const debugLog = (...args) => {
  if (process.env.DEBUG_SLS_OTEL_LAYER) {
    process._rawDebug(...args);
  }
};
debugLog('Internal extension: Init');

const http = require('http');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { InMemorySpanExporter } = require('@opentelemetry/sdk-trace-base');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { detectResources, envDetector, processDetector } = require('@opentelemetry/resources');
const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk');
const { getEnv } = require('@opentelemetry/core');
const { awsLambdaDetector } = require('@opentelemetry/resource-detector-aws');
const { DnsInstrumentation } = require('@opentelemetry/instrumentation-dns');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { GraphQLInstrumentation } = require('@opentelemetry/instrumentation-graphql');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
const { HapiInstrumentation } = require('@opentelemetry/instrumentation-hapi');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { IORedisInstrumentation } = require('@opentelemetry/instrumentation-ioredis');
const { KoaInstrumentation } = require('@opentelemetry/instrumentation-koa');
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { MySQLInstrumentation } = require('@opentelemetry/instrumentation-mysql');
const { NetInstrumentation } = require('@opentelemetry/instrumentation-net');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
const { FastifyInstrumentation } = require('@opentelemetry/instrumentation-fastify');
const AwsLambdaInstrumentation = require('./aws-lambda-instrumentation');
const { diag, DiagConsoleLogger } = require('@opentelemetry/api');
const SlsSpanProcessor = require('./span-processor');
const { detectEventType } = require('./event-detection');
const userSettings = require('./user-settings');

const OTEL_SERVER_PORT = 2772;
const logLevel = getEnv().OTEL_LOG_LEVEL;
diag.setLogger(new DiagConsoleLogger(), logLevel);
const telemetryServerUrl = `http://localhost:${OTEL_SERVER_PORT}`;

const tracerProvider = new NodeTracerProvider();
const memoryExporter = new InMemorySpanExporter();
const spanProcessor = new SlsSpanProcessor(memoryExporter);
tracerProvider.addSpanProcessor(spanProcessor);
tracerProvider.register();

const eventData = {};
let timeoutHandler;
let transactionCount = 0;

const requestHandler = async (span, { event, context }) => {
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
    computeCustomLogGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
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
    eventData[context.awsRequestId].rawHttpPath = event.path;
    eventData[context.awsRequestId].eventCustomHttpMethod = event.requestContext.httpMethod;
    eventData[context.awsRequestId].eventCustomDomain = event.requestContext.domainName;
    eventData[context.awsRequestId].eventCustomRequestTimeEpoch =
      event.requestContext.requestTimeEpoch;
  } else if (eventType === 'aws.apigatewayv2.http') {
    eventData[context.awsRequestId].eventCustomApiId = event.requestContext.apiId;
    eventData[context.awsRequestId].eventSource = 'aws.apigateway';
    eventData[context.awsRequestId].eventCustomAccountId = event.requestContext.accountId;
    const routeKey = event.requestContext.routeKey;
    eventData[context.awsRequestId].httpPath =
      routeKey.split(' ')[1] || event.requestContext.routeKey;
    eventData[context.awsRequestId].rawHttpPath = event.rawPath;
    eventData[context.awsRequestId].eventCustomHttpMethod = event.requestContext.http.method;
    eventData[context.awsRequestId].eventCustomDomain = event.requestContext.domainName;
    eventData[context.awsRequestId].eventCustomRequestTimeEpoch = event.requestContext.timeEpoch;
  }

  const eventDataPayload = {
    recordType: 'eventData',
    record: {
      eventData: { [context.awsRequestId]: eventData[context.awsRequestId] },
      span: {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      },
    },
  };
  if (!userSettings.request.disabled) {
    eventDataPayload.record.requestEventPayload = {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      requestData: event,
      timestamp: EvalError.$serverlessInvocationStart,
      executionId: context.awsRequestId,
    };
  }

  const requestBody = JSON.stringify(eventDataPayload);
  debugLog('Internal extension: Send event data');
  if (process.env.TEST_DRY_LOG) {
    process.stdout.write(`⚡ eventData: ${requestBody}\n`);
  } else {
    // Send request data to external so that we can attach this data to logs
    const requestStartTime = process.hrtime.bigint();
    await new Promise((resolve, reject) => {
      const request = http.request(
        telemetryServerUrl,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
        },
        (response) => {
          if (response.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Unexpected response status code: ${response.statusCode}`));
          }
        }
      );
      request.on('error', reject);
      request.write(requestBody);
      request.end();
    });
    debugLog(
      `Internal extension request [eventData]: ok in: ${Math.round(
        Number(process.hrtime.bigint() - requestStartTime) / 1000000
      )}ms`
    );
  }
};

const responseHandler = async (span, { res, err }, isTimeout) => {
  await tracerProvider.forceFlush();
  spanProcessor.finishAllSpans();
  const spans = memoryExporter.getFinishedSpans();

  let pathData;
  let functionData;
  let executionId;
  if (span) {
    executionId = span.attributes['faas.execution'];
    functionData = eventData[span.attributes['faas.execution']];
    pathData = {
      'http.path': functionData.httpPath,
    };
  } else {
    // Find data from unfinished spans
    pathData = spans.reduce(
      (obj, val) => {
        if (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-aws-lambda') {
          executionId = val.attributes['faas.execution'];
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
        const spanStartTime = val.startTime || [0, 0];
        const spanEndTime = val.endTime || [0, 0];
        return {
          startTime: new Date((spanStartTime[0] * 1000000000 + spanStartTime[1]) / 1000000),
          endTime: new Date((spanEndTime[0] * 1000000000 + spanEndTime[1]) / 1000000),
        };
      }
      return obj;
    },
    { startTime: new Date(), endTime: new Date() }
  );

  functionData.startTime = st.getTime();
  functionData.endTime = et.getTime();

  if (!err && !res) {
    pathData['http.status_code'] = 500;
  } else if (pathData) {
    let statusCode = (res || {}).statusCode || 200;
    if (err && !(res || {}).statusCode) {
      statusCode = 500;
    }
    pathData['http.status_code'] = statusCode;
  }

  functionData.error = false;
  functionData.timeout = isTimeout;
  if (isTimeout) {
    functionData.error = true;
    functionData.errorCulprit = 'timeout';
    functionData.errorType = 'timeout';
  } else if (err) {
    functionData.error = true;
    functionData.errorCulprit = err.message;
    functionData.errorType = 'handled';
    functionData.errorMessage = err.message;
    functionData.errorStacktrace = err.stack;
  } else if (
    pathData['http.status_code'] >= 500 &&
    ['aws.apigateway.http', 'aws.apigatewayv2.http'].includes(functionData.eventType)
  ) {
    // This happens if we get a 500 status code set explicity within in the app
    functionData.error = true;
    functionData.errorCulprit = 'internal server error';
    functionData.errorType = 'handled';
    functionData.errorMessage = 'internal server error';
    functionData.errorStacktrace = 'internal server error';
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
      (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-express' &&
        val.name === 'middleware - bound ') ||
      (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-express' &&
        /request handler - /i.test(val.name)) ||
      (val.instrumentationLibrary.name === '@opentelemetry/instrumentation-fastify' &&
        /request handler - /i.test(val.name))
    ) {
      return val.attributes['http.route'];
    }
    return finalPath;
  }, pathData['http.path']);

  // Check for Koa path
  pathData['http.path'] = spans.reduce((finalPath, val) => {
    if (
      val.instrumentationLibrary.name === '@opentelemetry/instrumentation-koa' &&
      /router - /gi.test(val.name)
    ) {
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
        const spanStartTime = val.startTime || [0, 0];
        const spanEndTime = val.endTime || [0, 0];

        let attributes = {
          ...val.attributes,
          'sls.original_properties': Object.keys(val.attributes).join(','),
        };
        if (
          firstThing.instrumentationLibrary.name === '@opentelemetry/instrumentation-aws-lambda'
        ) {
          attributes = {
            ...val.attributes,
            'sls.original_properties': Object.keys(val.attributes).join(','),
            // Only add path data if we have an http.path
            ...(!pathData['http.path'] ? {} : pathData),
          };
        }

        return {
          traceId,
          spanId,
          parentSpanId: val.parentSpanId,
          // This is a bug with the express instrumentation where the route handler
          // does not resolve until the lambda invocation is complete 🤷‍♂️
          name:
            val.name === 'middleware - bound '
              ? `request handler - ${pathData['http.path']}`
              : val.name,
          kind: 'SPAN_KIND_SERVER',
          startTimeUnixNano: `${spanStartTime[0] * 1000000000 + spanStartTime[1]}`,
          endTimeUnixNano: `${spanEndTime[0] * 1000000000 + spanEndTime[1]}`,
          attributes,
          status: {},
        };
      })
      .reduce((obj, innerSpan) => {
        obj[innerSpan.spanId] = innerSpan;
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

  const telemetryDataPayload = {
    recordType: 'telemetryData',
    requestId: executionId,
    record: {
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
  };

  if (!userSettings.response.disabled) {
    telemetryDataPayload.record.responseEventPayload = {
      responseData: res,
      errorData: err,
      executionId,
      isTimeout,
      traceId: span ? span.spanContext().traceId : null,
      spanId: span ? span.spanContext().spanId : null,
    };
  }

  const requestBody = JSON.stringify(telemetryDataPayload);
  debugLog('Internal extension: Send telemetry data');
  if (process.env.TEST_DRY_LOG) {
    process.stdout.write(`⚡ telemetryData: ${requestBody}\n`);
  } else {
    const requestStartTime = process.hrtime.bigint();
    await new Promise((resolve, reject) => {
      const request = http.request(
        telemetryServerUrl,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
        },
        (response) => {
          if (response.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Unexpected response status code: ${response.statusCode}`));
          }
        }
      );
      request.on('error', reject);
      request.write(requestBody);
      request.end();
    });
    debugLog(
      `Internal extension request [telemetryData]: ok in: ${Math.round(
        Number(process.hrtime.bigint() - requestStartTime) / 1000000
      )}ms`
    );
  }

  // Reset the exporter so we don't see duplicates
  memoryExporter.reset();
};

const handleTimeouts = (remainingTime) => {
  timeoutHandler = setTimeout(() => {
    responseHandler(null, {}, true);
  }, remainingTime - 50).unref();
};

registerInstrumentations({
  tracerProvider,
  instrumentations: [
    new AwsInstrumentation({
      suppressInternalInstrumentation: true,
    }),
    new AwsLambdaInstrumentation({
      disableAwsContextPropagation: true,
      requestHook: (...args) => {
        EvalError.$serverlessRequestHandlerPromise = requestHandler(...args);
      },
      responseHook: (span, { err, res }) => {
        clearTimeout(timeoutHandler);
        EvalError.$serverlessResponseHandlerPromise = responseHandler(span, { err, res });
      },
    }),
    new DnsInstrumentation(),
    new ExpressInstrumentation(),
    new GraphQLInstrumentation(),
    new GrpcInstrumentation(),
    new HapiInstrumentation(),
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new KoaInstrumentation(),
    new MongoDBInstrumentation(),
    new MySQLInstrumentation(),
    new NetInstrumentation(),
    new PgInstrumentation(),
    new RedisInstrumentation(),
    new FastifyInstrumentation(),
  ],
});

module.exports = detectResources({
  detectors: [awsLambdaDetector, envDetector, processDetector],
}).then((resource) => (tracerProvider.resource = tracerProvider.resource.merge(resource)));

const { handlerLoadDuration } = require('./prepare-wrapper')();

if (process.env.DEBUG_SLS_OTEL_LAYER) {
  process._rawDebug(
    'Extension overhead duration: internal initialization:',
    `${Math.round(
      Number(process.hrtime.bigint() - processStartTime - handlerLoadDuration) / 1000000
    )}ms`
  );
}
