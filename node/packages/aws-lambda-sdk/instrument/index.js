// Decorate original handler with Serverless SDK instrumentation

'use strict';

const zlib = require('zlib');
const ensurePlainFunction = require('type/plain-function/ensure');
const traceProto = require('@serverless/sdk-schema/dist/trace');
const requestResponseProto = require('@serverless/sdk-schema/dist/request_response');
const resolveEventTags = require('./lib/resolve-event-tags');
const resolveResponseTags = require('./lib/resolve-response-tags');
const sendTelemetry = require('./lib/send-telemetry');
const flushSpans = require('./lib/auto-send-spans').flush;
const filterCapturedEvent = require('./lib/filter-captured-event');
const invocationContextAccessor = require('./lib/invocation-context-accessor');
const resolveIsApiEvent = require('./lib/is-api-event');
const pkgJson = require('../package');

const serverlessSdk = require('./lib/sdk');

const objHasOwnProperty = Object.prototype.hasOwnProperty;
const unresolvedPromise = new Promise(() => {});

const coreTraceSpanNames = new Set([
  'aws.lambda',
  'aws.lambda.initialization',
  'aws.lambda.invocation',
]);
const alertEventNames = new Set(['telemetry.error.generated.v1']);

const capturedEvents = [];
serverlessSdk._eventEmitter.on('captured-event', (capturedEvent) =>
  capturedEvents.push(capturedEvent)
);

const { traceSpans } = serverlessSdk;
const { awsLambda: awsLambdaSpan, awsLambdaInitialization: awsLambdaInitializationSpan } =
  traceSpans;

const toProtobufEpochTimestamp = awsLambdaSpan.constructor._toProtobufEpochTimestamp;

const resolveBodyString = (data, prefix) => {
  if (data === undefined) return null;
  if (awsLambdaSpan.tags.get('aws.lambda.event_source') === 'aws.apigateway') {
    if (typeof data.body === 'string') {
      if (data.isBase64Encoded) {
        data = { ...data };
        delete data.body;
        serverlessSdk._reportNotice('Binary body excluded', `${prefix}_BODY_BINARY`, {
          _traceSpan: awsLambdaSpan,
        });
      }
    }
  }
  const stringifiedBody = JSON.stringify(data);
  if (Buffer.byteLength(stringifiedBody) > serverlessSdk._maximumBodyByteLength) {
    serverlessSdk._reportNotice('Large body excluded', `${prefix}_BODY_TOO_LARGE`, {
      _traceSpan: awsLambdaSpan,
    });
    return null;
  }
  return stringifiedBody;
};

const reportRequest = async (event, context) => {
  const payload = (serverlessSdk._lastRequest = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version, runtime: 'nodejs' },
    },
    traceId: Buffer.from(awsLambdaSpan.traceId),
    spanId: Buffer.from(awsLambdaSpan.id),
    requestId: context.awsRequestId,
    timestamp: toProtobufEpochTimestamp(traceSpans.awsLambdaInvocation.startTime),
    body: resolveBodyString(event, 'INPUT'),
    origin: 1,
  });
  const payloadBuffer = (serverlessSdk._lastRequestBuffer =
    requestResponseProto.RequestResponse.encode(payload).finish());
  await sendTelemetry('request-response', payloadBuffer);
};

const reportResponse = async (response, context, endTime) => {
  const responseString = resolveBodyString(response, 'OUTPUT');
  const payload = (serverlessSdk._lastResponse = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version, runtime: 'nodejs' },
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

let isFirstInvocation = true;
let isAfterNotSampledApiRequest = false;

const reportTrace = ({ isErrorOutcome }) => {
  const isApiEvent = resolveIsApiEvent();
  let shouldSetIsAfterNotSampledApiRequest = false;
  const isSampledOut =
    (() => {
      // This function determines if a trace should be sampled or not
      //
      // Do not sample when invocation ends with error
      if (isErrorOutcome) return false;
      // Do not sample when in debug mode
      if (serverlessSdk._isDebugMode) return false;
      // Do not sample when in dev mode
      if (serverlessSdk._isDevMode) return false;
      // Do not sample when any error event is captured
      if (capturedEvents.some(({ name }) => alertEventNames.has(name))) return false;

      if (isAfterNotSampledApiRequest) {
        // Do not sample two consecutive API requests (to handle OPTIONS + actual request)
        if (isApiEvent) return false;
      }
      // Do not sample first invocation, otherwise set sampling rate at 10%
      // (for API we apply correction as requests are passed through in pairs)
      if (!isFirstInvocation && Math.random() > (isApiEvent ? 0.05 : 0.1)) return true;
      shouldSetIsAfterNotSampledApiRequest = isApiEvent;
      return false;
    })() || undefined;
  isFirstInvocation = false;
  if (isAfterNotSampledApiRequest) isAfterNotSampledApiRequest = false;
  else if (shouldSetIsAfterNotSampledApiRequest) isAfterNotSampledApiRequest = true;

  const payload = (serverlessSdk._lastTrace = {
    isSampledOut,
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version, runtime: 'nodejs' },
    },
    spans: Array.from(awsLambdaSpan.spans, (span) => {
      if (isSampledOut && !coreTraceSpanNames.has(span.name)) return null;
      const spanPayload = span.toProtobufObject();
      delete spanPayload.input;
      delete spanPayload.output;
      return spanPayload;
    }).filter(Boolean),
    events: isSampledOut
      ? []
      : capturedEvents
          .filter(filterCapturedEvent)
          .map((capturedEvent) => capturedEvent.toProtobufObject()),
    customTags:
      !isSampledOut && objHasOwnProperty.call(serverlessSdk, '_customTags')
        ? JSON.stringify(serverlessSdk._customTags)
        : undefined,
  });
  const payloadBuffer = (serverlessSdk._lastTraceBuffer =
    traceProto.TracePayload.encode(payload).finish());
  process._rawDebug(`SERVERLESS_TELEMETRY.TZ.${zlib.gzipSync(payloadBuffer).toString('base64')}`);
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

const clearRootSpan = () => {
  delete awsLambdaSpan.traceId;
  delete awsLambdaSpan.id;
  delete awsLambdaSpan.endTime;
  awsLambdaSpan.tags.reset();
  awsLambdaSpan._subSpans.clear();
  capturedEvents.length = 0;
  if (objHasOwnProperty.call(serverlessSdk, '_customTags')) serverlessSdk._customTags.clear();
};

const closeTrace = async (outcome, outcomeResult) => {
  isCurrentInvocationResolved = true;
  let isRootSpanReset = false;
  try {
    const endTime = process.hrtime.bigint();
    const isErrorOutcome = outcome.startsWith('error:');

    awsLambdaSpan.tags.set('aws.lambda.outcome', resolveOutcomeEnumValue(outcome));
    if (isErrorOutcome) {
      serverlessSdk.captureError(outcomeResult, { _type: 'unhandled', _timestamp: endTime });
    } else {
      resolveResponseTags(outcomeResult);
    }

    if (
      serverlessSdk._isDevMode &&
      !serverlessSdk._settings.disableRequestResponseMonitoring &&
      !isErrorOutcome
    ) {
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
    if (invocationContextAccessor.value) reportTrace({ isErrorOutcome });
    flushSpans();
    clearRootSpan();
    isRootSpanReset = true;

    await Promise.all(serverlessSdk._deferredTelemetryRequests);
    serverlessSdk._deferredTelemetryRequests.length = 0;
    serverlessSdk._debugLog(
      'Overhead duration: Internal response:',
      `${Math.round(Number(process.hrtime.bigint() - endTime) / 1000000)}ms`
    );
  } catch (error) {
    serverlessSdk._reportError(error);
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

const observeNotRespondingHandler = (() => {
  // When event loop is drained, AWS closes the invocation without waiting for an eventual
  // callback to be called or promise resolved.
  // Below logic we detect and handle this scenario
  const exit = () => {
    if (typeof global[Symbol.for('aws.lambda.beforeExit')] === 'function') {
      global[Symbol.for('aws.lambda.beforeExit')]();
    }
  };

  return () => {
    const originalCallback = global[Symbol.for('aws.lambda.beforeExit')];
    global[Symbol.for('aws.lambda.beforeExit')] = () => {
      global[Symbol.for('aws.lambda.beforeExit')] = originalCallback;
      if (!isCurrentInvocationResolved) {
        serverlessSdk._reportWarning(
          'Invocation closed without handler providing response for the invocation',
          'HANDLER_NO_RESPONSE',
          { type: 'USER' }
        );
        closeTrace('success').finally(exit);
      } else {
        exit();
      }
    };
  };
})();

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
  const isResponseStreaming = originalHandler[Symbol.for('aws.lambda.runtime.handler.streaming')];

  awsLambdaInitializationSpan.close();
  const decoratedHandler = (event, context, awsCallback) => {
    const requestStartTime = process.hrtime.bigint();
    let wrappedCallback;
    let contextDone;
    let responseStream;

    let originalDone;
    isCurrentInvocationResolved = false;
    const invocationId = ++currentInvocationId;
    if (isResponseStreaming) {
      responseStream = context;
      context = awsCallback;
      awsCallback = null;
    }

    try {
      serverlessSdk._debugLog('Invocation: start');
      observeNotRespondingHandler();
      invocationContextAccessor.set(context);
      if (invocationId > 1) awsLambdaSpan.startTime = requestStartTime;
      awsLambdaSpan.tags.set('aws.lambda.request_id', context.awsRequestId);
      if (isResponseStreaming) awsLambdaSpan.tags.set('aws.lambda.response_mode', 2);

      traceSpans.awsLambdaInvocation = serverlessSdk._createTraceSpan('aws.lambda.invocation', {
        startTime: requestStartTime,
      });
      resolveEventTags(event);
      if (serverlessSdk._isDevMode && !serverlessSdk._settings.disableRequestResponseMonitoring) {
        serverlessSdk._deferredTelemetryRequests.push(reportRequest(event, context));
      }

      const wrapAwsCallback =
        (someAwsCallback, isCallbackResolution = false) =>
        (...args) => {
          if (invocationId !== currentInvocationId) return;
          if (isCurrentInvocationResolved) return;

          if (isCallbackResolution && args[0] == null && context.callbackWaitsForEmptyEventLoop) {
            isCurrentInvocationResolved = true;
            someAwsCallback(...args);
            const awsExitCallback = global[Symbol.for('aws.lambda.beforeExit')];
            global[Symbol.for('aws.lambda.beforeExit')] = () => {
              global[Symbol.for('aws.lambda.beforeExit')] = awsExitCallback;
              closeTrace('success', args[1]).finally(awsExitCallback);
            };
          } else {
            closeTrace(
              args[0] == null ? 'success' : 'error:handled',
              args[0] == null ? args[1] : args[0]
            ).then(() => someAwsCallback(...args), someAwsCallback);
          }
        };
      originalDone = context.done;
      contextDone = wrapAwsCallback(originalDone);
      context.done = contextDone;
      context.succeed = (result) => contextDone(null, result);
      context.fail = (err) => contextDone(err == null ? 'handled' : err);

      if (awsCallback) wrappedCallback = wrapAwsCallback(awsCallback, true);
      // TODO: Insert eventual request handling
      serverlessSdk._debugLog(
        'Overhead duration: Internal request:',
        `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
      );
    } catch (error) {
      serverlessSdk._reportError(error);
      clearRootSpan();
      if (originalDone) contextDone = originalDone;
      return isResponseStreaming
        ? originalHandler(event, responseStream, context)
        : originalHandler(event, context, awsCallback);
    }
    const eventualResult = (() => {
      try {
        return isResponseStreaming
          ? originalHandler(event, responseStream, context)
          : originalHandler(event, context, wrappedCallback);
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
  try {
    // Ensure to pass through eventual AWS handler resolution markers (e.g. response streaming)
    Object.defineProperties(decoratedHandler, Object.getOwnPropertyDescriptors(originalHandler));
  } catch {
    // ignore
  }
  return decoratedHandler;
};
