'use strict';

const { gzipSync } = require('zlib');
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
const fetch = require('node-fetch');
const { logMessage, OTEL_SERVER_PORT } = require('../lib/helper');
const SlsSpanProcessor = require('./span-processor');
const { detectEventType } = require('./event-detection');

const logLevel = getEnv().OTEL_LOG_LEVEL;
diag.setLogger(new DiagConsoleLogger(), logLevel);

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
    functionData.errorExceptionType = 'TimeoutError';
    functionData.errorExceptionMessage = '';
    functionData.errorExceptionStacktrace =
      'Function execution duration going to exceeded configured timeout limit.';
  } else if (err) {
    functionData.error = true;
    functionData.errorCulprit = err.message;
    functionData.errorExceptionType = typeof err;
    functionData.errorExceptionMessage = err.message;
    functionData.errorExceptionStacktrace = err.stack;
  } else if (
    pathData['http.status_code'] >= 500 &&
    ['aws.apigateway.http', 'aws.apigatewayv2.http'].includes(functionData.eventType)
  ) {
    // This happens if we get a 500 status code set explicity within in the app
    functionData.error = true;
    functionData.errorCulprit = 'internal server error';
    functionData.errorExceptionType = typeof new Error();
    functionData.errorExceptionMessage = 'internal server error';
    functionData.errorExceptionStacktrace = 'internal server error';
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
        const startTime = val.startTime || [0, 0];
        const endTime = val.endTime || [0, 0];

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
          startTimeUnixNano: `${startTime[0] * 1000000000 + startTime[1]}`,
          endTimeUnixNano: `${endTime[0] * 1000000000 + endTime[1]}`,
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

  const telemetryDataPayload = {
    responseEventPayload: {
      responseData: res,
      errorData: err,
      executionId,
      isTimeout,
      traceId: span ? span.spanContext().traceId : null,
    },
    function: functionData,
    traces: {
      resourceSpans: [
        {
          resource: tracerProvider.resource.attributes,
          instrumentationLibrarySpans: data,
        },
      ],
    },
  };
  if (process.env.TEST_DRY_LOG) {
    process._rawDebug(
      `${require('util').inspect(telemetryDataPayload, { depth: Infinity, colors: true })}\n`
    );
  } else {
    const logString = `⚡.${gzipSync(JSON.stringify(telemetryDataPayload)).toString('base64')}`;
    await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
      method: 'post',
      body: JSON.stringify({
        recordType: 'telemetryData',
        record: `${new Date().toISOString()}\t${executionId}\t${logString}`,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

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
        eventData[context.awsRequestId].eventCustomRequestTimeEpoch =
          event.requestContext.timeEpoch;
      }

      const eventDataPayload = {
        recordType: 'eventData',
        record: {
          eventData: { [context.awsRequestId]: eventData[context.awsRequestId] },
          span: {
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
          },
          requestEventPayload: {
            traceId: span.spanContext().traceId,
            requestData: event,
            executionId: context.awsRequestId,
          },
        },
      };

      if (process.env.TEST_DRY_LOG) {
        process._rawDebug(
          `${require('util').inspect(eventDataPayload, { depth: Infinity, colors: true })}\n`
        );
      } else {
        // Send request data to external so that we can attach this data to logs
        await fetch(`http://localhost:${OTEL_SERVER_PORT}`, {
          method: 'post',
          body: JSON.stringify(eventDataPayload),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    },
    responseHook: async (span, { err, res }) => {
      clearTimeout(timeoutHandler);
      await responseHandler(span, { err, res });
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
];

// Register instrumentations synchronously to ensure code is patched even before provider is ready.
registerInstrumentations({
  instrumentations,
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

  const sdkRegistrationConfig = {};
  tracerProvider.register(sdkRegistrationConfig);

  // Re-register instrumentation with initialized provider. Patched code will see the update.
  registerInstrumentations({
    instrumentations,
    tracerProvider,
  });
}

module.exports = initializeProvider();

require('./prepare-wrapper')();
