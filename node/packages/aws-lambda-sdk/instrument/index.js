// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');
const traceProto = require('@serverless/sdk-schema/dist/trace');
const requestResponseProto = require('@serverless/sdk-schema/dist/request_response');
const resolveEventTags = require('./lib/resolve-event-tags');
const resolveResponseTags = require('./lib/resolve-response-tags');
const sendTelemetry = require('./lib/send-telemetry');
const flushSpans = require('./lib/auto-send-spans').flush;
const invocationContextAccessor = require('./lib/invocation-context-accessor');
const pkgJson = require('../package');

const serverlessSdk = require('./lib/sdk');

const objHasOwnProperty = Object.prototype.hasOwnProperty;
const unresolvedPromise = new Promise(() => {});

const capturedEvents = [];
serverlessSdk._eventEmitter.on('captured-event', (capturedEvent) =>
  capturedEvents.push(capturedEvent)
);

const { traceSpans } = serverlessSdk;
const { awsLambda: awsLambdaSpan, awsLambdaInitialization: awsLambdaInitializationSpan } =
  traceSpans;

const toProtobufEpochTimestamp = awsLambdaSpan.constructor._toProtobufEpochTimestamp;

const reportRequest = async (event, context) => {
  const payload = (serverlessSdk._lastRequest = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    traceId: Buffer.from(awsLambdaSpan.traceId),
    spanId: Buffer.from(awsLambdaSpan.id),
    requestId: context.awsRequestId,
    timestamp: toProtobufEpochTimestamp(traceSpans.awsLambdaInvocation.startTime),
    body: JSON.stringify(event),
    origin: 1,
  });
  const payloadBuffer = (serverlessSdk._lastRequestBuffer =
    requestResponseProto.RequestResponse.encode(payload).finish());
  await sendTelemetry('request-response', payloadBuffer);
};

const resolveResponseString = (response) => {
  if (response === undefined) return null;
  if (awsLambdaSpan.tags.get('aws.lambda.event_source') === 'aws.apigateway') {
    if (typeof response.body === 'string') {
      response = { ...response };
      if (response.isBase64Encoded) {
        delete response.body;
        response.isBodyExcluded = true;
      } else {
        try {
          JSON.parse(response.body);
        } catch {
          delete response.body;
          response.isBodyExcluded = true;
        }
      }
    }
  }
  return JSON.stringify(response);
};

const reportResponse = async (response, context, endTime) => {
  const responseString = resolveResponseString(response);
  const payload = (serverlessSdk._lastResponse = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    traceId: Buffer.from(awsLambdaSpan.traceId),
    spanId: Buffer.from(awsLambdaSpan.id),
    requestId: context.awsRequestId,
    timestamp: toProtobufEpochTimestamp(endTime),
    body: responseString || undefined,
    origin: 2,
  });
  const payloadBuffer = (serverlessSdk._lastResponseBuffer =
    requestResponseProto.RequestResponse.encode(payload).finish());
  await sendTelemetry('request-response', payloadBuffer);
};

const reportTrace = () => {
  const payload = (serverlessSdk._lastTrace = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    spans: Array.from(awsLambdaSpan.spans).map((span) => {
      const spanPayload = span.toProtobufObject();
      delete spanPayload.input;
      delete spanPayload.output;
      return spanPayload;
    }),
    events: capturedEvents.map((capturedEvent) => capturedEvent.toProtobufObject()),
    customTags: objHasOwnProperty.call(serverlessSdk, '_customTags')
      ? JSON.stringify(serverlessSdk._customTags)
      : undefined,
  });
  const payloadBuffer = (serverlessSdk._lastTraceBuffer =
    traceProto.TracePayload.encode(payload).finish());
  process._rawDebug(`SERVERLESS_TELEMETRY.T.${payloadBuffer.toString('base64')}`);
};

const resolveOutcomeEnumValue = (value) => {
  switch (value) {
    case 'success':
      return 1;
    case 'error:handled':
      return 5;
    case 'error:unhandled':
      return 3;
    default:
      throw new Error(`Unexpected outcome value: ${value}`);
  }
};

let isCurrentInvocationResolved = false;

const closeTrace = async (outcome, outcomeResult) => {
  isCurrentInvocationResolved = true;
  let isRootSpanReset = false;
  const clearRootSpan = () => {
    delete awsLambdaSpan.traceId;
    delete awsLambdaSpan.id;
    delete awsLambdaSpan.endTime;
    awsLambdaSpan.tags.reset();
    awsLambdaSpan.subSpans.clear();
    capturedEvents.length = 0;
    if (objHasOwnProperty.call(serverlessSdk, '_customTags')) serverlessSdk._customTags.clear();
    isRootSpanReset = true;
  };

  try {
    const endTime = process.hrtime.bigint();
    const isErrorOutcome = outcome.startsWith('error:');

    awsLambdaSpan.tags.set('aws.lambda.outcome', resolveOutcomeEnumValue(outcome));
    if (isErrorOutcome) {
      serverlessSdk.captureError(outcomeResult, { _type: 'unhandled', _timestamp: endTime });
    } else {
      resolveResponseTags(outcomeResult);
    }

    if (!serverlessSdk._settings.disableRequestResponseMonitoring && !isErrorOutcome) {
      serverlessSdk._deferredTelemetryRequests.push(
        reportResponse(outcomeResult, invocationContextAccessor.value, endTime)
      );
    }
    if (!traceSpans.awsLambdaInitialization.endTime) {
      traceSpans.awsLambdaInitialization.close({ endTime });
    }
    if (traceSpans.awsLambdaInvocation) traceSpans.awsLambdaInvocation.close({ endTime });
    awsLambdaSpan.close({ endTime });
    // Root span comes with "aws.lambda.*" tags, which require unconditionally requestId
    // which we don't have if handler crashed at initialization
    if (invocationContextAccessor.value) reportTrace();
    flushSpans();
    clearRootSpan();

    await Promise.all(serverlessSdk._deferredTelemetryRequests);
    serverlessSdk._deferredTelemetryRequests.length = 0;
    serverlessSdk._debugLog(
      'Overhead duration: Internal response:',
      `${Math.round(Number(process.hrtime.bigint() - endTime) / 1000000)}ms`
    );
  } catch (error) {
    serverlessSdk._reportSdkError(error);
    if (!isRootSpanReset) clearRootSpan();
  }
};

if (!process.env.SLS_UNIT_TEST_RUN) {
  const wrapUnhandledErrorListener = (eventName) => {
    const [awsListener] = process.listeners(eventName);
    process.off(eventName, awsListener);
    process.on(eventName, (error) => {
      if (isCurrentInvocationResolved) {
        awsListener(error);
        return;
      }
      closeTrace('error:unhandled', error).finally(() =>
        process.nextTick(() => awsListener(error))
      );
    });
  };
  wrapUnhandledErrorListener('uncaughtException');
  wrapUnhandledErrorListener('unhandledRejection');
}

module.exports = (originalHandler, options = {}) => {
  ensurePlainFunction(originalHandler, { name: 'originalHandler' });
  serverlessSdk._initialize(options);
  if (!serverlessSdk.orgId) {
    throw new Error(
      'Serverless SDK Error: Cannot instrument function: "orgId" not provided. ' +
        'Ensure "SLS_ORG_ID" environment variable is set, ' +
        'or pass it with the options\n'
    );
  }
  let currentInvocationId = 0;

  awsLambdaInitializationSpan.close();
  return (event, context, awsCallback) => {
    const requestStartTime = process.hrtime.bigint();
    let wrappedCallback;
    let contextDone;

    let originalDone;
    isCurrentInvocationResolved = false;
    const invocationId = ++currentInvocationId;
    try {
      serverlessSdk._debugLog('Invocation: start');
      invocationContextAccessor.set(context);
      if (invocationId > 1) awsLambdaSpan.startTime = requestStartTime;
      awsLambdaSpan.tags.set('aws.lambda.request_id', context.awsRequestId);
      traceSpans.awsLambdaInvocation = serverlessSdk._createTraceSpan('aws.lambda.invocation', {
        startTime: requestStartTime,
      });
      resolveEventTags(event);
      if (!serverlessSdk._settings.disableRequestResponseMonitoring) {
        serverlessSdk._deferredTelemetryRequests.push(reportRequest(event, context));
      }

      const wrapAwsCallback =
        (someAwsCallback) =>
        (...args) => {
          if (invocationId !== currentInvocationId) return;
          if (isCurrentInvocationResolved) return;
          closeTrace(
            args[0] == null ? 'success' : 'error:handled',
            args[0] == null ? args[1] : args[0]
          ).then(() => someAwsCallback(...args), someAwsCallback);
        };
      originalDone = context.done;
      contextDone = wrapAwsCallback(originalDone);
      context.done = contextDone;
      context.succeed = (result) => contextDone(null, result);
      context.fail = (err) => contextDone(err == null ? 'handled' : err);

      wrappedCallback = wrapAwsCallback(awsCallback);
      // TODO: Insert eventual request handling
      serverlessSdk._debugLog(
        'Overhead duration: Internal request:',
        `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
      );
    } catch (error) {
      serverlessSdk._reportSdkError(error);
      if (originalDone) contextDone = originalDone;
      return originalHandler(event, context, awsCallback);
    }
    const eventualResult = (() => {
      try {
        return originalHandler(event, context, wrappedCallback);
      } catch (error) {
        // Propagate as uncaught exception
        process.nextTick(() => {
          throw error;
        });
        return null;
      }
    })();
    if (!eventualResult) return eventualResult;
    if (typeof eventualResult.then !== 'function') return eventualResult;
    return Promise.resolve(eventualResult)
      .then(
        async (result) => {
          if (invocationId !== currentInvocationId) return result;
          if (isCurrentInvocationResolved) {
            // If we're here, it means there's an uncaught exception of which propagation is
            // currently deferred (so SDK trace is propagated).
            // Return unresolvedPromise to ensure this function doesn't resolve successfuly
            // before the uncaught exception is propagated
            return unresolvedPromise;
          }
          await closeTrace('success', result);
          return result;
        },
        async (error) => {
          if (invocationId !== currentInvocationId) throw error;
          if (isCurrentInvocationResolved) return unresolvedPromise;
          await closeTrace('error:handled', error);
          throw error;
        }
      )
      .finally(() => {
        // AWS internally uses context methods to resolve promise result
        contextDone = originalDone;
      });
  };
};
