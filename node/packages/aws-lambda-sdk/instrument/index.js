// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');
const isError = require('type/error/is');
const coerceToString = require('type/string/coerce');
const traceProto = require('@serverless/sdk-schema/dist/trace');
const requestResponseProto = require('@serverless/sdk-schema/dist/request_response');
const resolveEventTags = require('./lib/resolve-event-tags');
const resolveResponseTags = require('./lib/resolve-response-tags');
const sendTelemetry = require('./lib/send-telemetry');
const flushSpans = require('./lib/auto-send-spans').flush;
const invocationContextAccessor = require('./lib/invocation-context-accessor');
const pkgJson = require('../package');

const serverlessSdk = global.serverlessSdk || require('../');

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
    events: [],
  });
  const payloadBuffer = (serverlessSdk._lastTraceBuffer =
    traceProto.TracePayload.encode(payload).finish());
  process._rawDebug(`SERVERLESS_TELEMETRY.T.${payloadBuffer.toString('base64')}`);
};

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
    let closeInvocation;
    let originalDone;
    try {
      serverlessSdk._debugLog('Invocation: start');
      invocationContextAccessor.set(context);
      let isResolved = false;
      let responseStartTime;
      const invocationId = ++currentInvocationId;
      if (invocationId > 1) awsLambdaSpan.startTime = requestStartTime;
      awsLambdaSpan.tags.set('aws.lambda.request_id', context.awsRequestId);
      const awsLambdaInvocationSpan = (traceSpans.awsLambdaInvocation =
        serverlessSdk.createTraceSpan('aws.lambda.invocation', { startTime: requestStartTime }));
      resolveEventTags(event);
      if (!serverlessSdk._settings.disableRequestResponseMonitoring) {
        serverlessSdk._deferredTelemetryRequests.push(reportRequest(event, context));
      }

      closeInvocation = async (outcome, outcomeResult) => {
        try {
          if (invocationId !== currentInvocationId) return;
          if (isResolved) return;
          responseStartTime = process.hrtime.bigint();
          isResolved = true;

          awsLambdaSpan.tags.set('aws.lambda.outcome', outcome);
          if (outcome === 'error:handled') {
            const errorMessage =
              (outcomeResult && outcomeResult.message) || coerceToString(outcomeResult);
            if (errorMessage) {
              awsLambdaSpan.tags.set(
                'aws.lambda.error_exception_message',
                errorMessage.length > 1000 ? `${errorMessage.slice(0, 1000)}[…]` : errorMessage
              );
              if (isError(outcomeResult) && outcomeResult.stack) {
                awsLambdaSpan.tags.set(
                  'aws.lambda.error_exception_stacktrace',
                  outcomeResult.stack
                );
              }
            }
          } else {
            resolveResponseTags(outcomeResult);
          }

          const endTime = process.hrtime.bigint();
          if (
            !serverlessSdk._settings.disableRequestResponseMonitoring &&
            outcome !== 'error:handled'
          ) {
            serverlessSdk._deferredTelemetryRequests.push(
              reportResponse(outcomeResult, context, endTime)
            );
          }
          awsLambdaInvocationSpan.close({ endTime });
          awsLambdaSpan.close({ endTime });
          reportTrace();
          flushSpans();

          // Clear root span
          delete awsLambdaSpan.traceId;
          delete awsLambdaSpan.id;
          delete awsLambdaSpan.endTime;
          awsLambdaSpan.tags.reset();
          awsLambdaSpan.subSpans.clear();

          await Promise.all(serverlessSdk._deferredTelemetryRequests);
          serverlessSdk._deferredTelemetryRequests.length = 0;
          serverlessSdk._debugLog(
            'Overhead duration: Internal response:',
            `${Math.round(Number(process.hrtime.bigint() - responseStartTime) / 1000000)}ms`
          );
        } catch (error) {
          process._rawDebug(
            'Fatal Serverless SDK Error: ' +
              'Please report at https://github.com/serverless/console/issues: ' +
              'Response handling failed: ',
            error && (error.stack || error)
          );
        }
      };
      const wrapAwsCallback =
        (someAwsCallback) =>
        (...args) => {
          closeInvocation(
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
      process._rawDebug(
        'Fatal Serverless SDK Error: ' +
          'Please report at https://github.com/serverless/console/issues: ' +
          'Request handling failed: ',
        error && (error.stack || error)
      );
      if (originalDone) contextDone = originalDone;
      return originalHandler(event, context, awsCallback);
    }
    const eventualResult = originalHandler(event, context, wrappedCallback);
    if (!eventualResult) return eventualResult;
    if (typeof eventualResult.then !== 'function') return eventualResult;
    return Promise.resolve(eventualResult)
      .then(
        async (result) => {
          await closeInvocation('success', result);
          return result;
        },
        async (error) => {
          await closeInvocation('error:handled', error);
          throw error;
        }
      )
      .finally(() => {
        // AWS internally uses context methods to resolve promise result
        contextDone = originalDone;
      });
  };
};
