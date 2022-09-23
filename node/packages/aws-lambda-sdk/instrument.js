// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');
const isError = require('type/error/is');
const isPlainObject = require('type/plain-object/is');
const coerceToString = require('type/string/coerce');
const traceProto = require('@serverless/sdk-schema/dist/trace');
const requestResponseProto = require('@serverless/sdk-schema/dist/request_response');
const resolveEventTags = require('./lib/resolve-event-tags');
const resolveResponseTags = require('./lib/resolve-response-tags');
const pkgJson = require('./package');

const serverlessSdk = global.serverlessSdk || require('./');

const { traceSpans } = serverlessSdk;
const { awsLambda: awsLambdaSpan, awsLambdaInitialization: awsLambdaInitializationSpan } =
  traceSpans;

const debugLog = (...args) => {
  if (process.env.SLS_SDK_DEBUG) process._rawDebug('⚡ SDK:', ...args);
};

const writeRequest = (event, context) => {
  const payload = (serverlessSdk._lastRequest = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    traceId: Buffer.from(awsLambdaSpan.traceId),
    spanId: Buffer.from(awsLambdaSpan.id),
    requestId: context.awsRequestId,
    data: { $case: 'requestData', requestData: JSON.stringify(event) },
  });
  const payloadBuffer = (serverlessSdk._lastRequestBuffer =
    requestResponseProto.RequestResponse.encode(payload).finish());
  process._rawDebug(`SERVERLESS_TELEMETRY.R.${payloadBuffer.toString('base64')}`);
};

const resolveResponseString = (response) => {
  if (!isPlainObject(response)) return null;
  if (awsLambdaSpan.tags.get('aws.lambda.event_source') === 'aws.apigateway') {
    if (response.isBase64Encoded) return null;
    if (typeof response.body !== 'string') return null;
    try {
      JSON.parse(response.body);
      return response.body;
    } catch {
      return null;
    }
  }
  return JSON.stringify(response);
};

const writeResponse = (response, context) => {
  const responseString = resolveResponseString(response);
  if (!responseString) return;
  const payload = (serverlessSdk._lastResponse = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    traceId: Buffer.from(awsLambdaSpan.traceId),
    spanId: Buffer.from(awsLambdaSpan.id),
    requestId: context.awsRequestId,
    data: { $case: 'responseData', responseData: responseString },
  });
  const payloadBuffer = (serverlessSdk._lastResponseBuffer =
    requestResponseProto.RequestResponse.encode(payload).finish());
  process._rawDebug(`SERVERLESS_TELEMETRY.R.${payloadBuffer.toString('base64')}`);
};

const writeTrace = () => {
  const payload = (serverlessSdk._lastTrace = {
    slsTags: {
      orgId: serverlessSdk.orgId,
      service: process.env.AWS_LAMBDA_FUNCTION_NAME,
      sdk: { name: pkgJson.name, version: pkgJson.version },
    },
    spans: Array.from(awsLambdaSpan.spans).map((span) => span.toProtobufObject()),
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
    debugLog('Invocation: start');
    let isResolved = false;
    let responseStartTime;
    const invocationId = ++currentInvocationId;
    if (invocationId > 1) {
      // Reset root span ids and startTime with every next invocation
      delete awsLambdaSpan.traceId;
      delete awsLambdaSpan.id;
      delete awsLambdaSpan.endTime;
      awsLambdaSpan.startTime = requestStartTime;
      awsLambdaSpan.tags.reset();
      awsLambdaSpan.subSpans.clear();
    }
    awsLambdaSpan.tags.set('aws.lambda.request_id', context.awsRequestId);
    const awsLambdaInvocationSpan = (traceSpans.awsLambdaInvocation = serverlessSdk.createTraceSpan(
      'aws.lambda.invocation',
      { startTime: requestStartTime }
    ));
    resolveEventTags(event);
    if (!serverlessSdk._settings.disableRequestMonitoring) writeRequest(event, context);

    const closeInvocation = (outcome, outcomeResult) => {
      if (invocationId !== currentInvocationId) return;
      if (isResolved) return;
      responseStartTime = process.hrtime.bigint();
      isResolved = true;

      awsLambdaSpan.tags.set('aws.lambda.outcome', outcome);
      if (outcome === 'error:handled') {
        const errorMessage = outcomeResult?.message || coerceToString(outcomeResult);
        if (errorMessage) {
          awsLambdaSpan.tags.set(
            'aws.lambda.error_exception_message',
            errorMessage.length > 1000 ? `${errorMessage.slice(0, 1000)}[…]` : errorMessage
          );
          if (isError(outcomeResult) && outcomeResult.stack) {
            awsLambdaSpan.tags.set('aws.lambda.error_exception_stacktrace', outcomeResult.stack);
          }
        }
      } else {
        resolveResponseTags(outcomeResult);
        if (!serverlessSdk._settings.disableResponseMonitoring) {
          writeResponse(outcomeResult, context);
        }
      }

      const endTime = process.hrtime.bigint();
      awsLambdaInvocationSpan.close({ endTime });
      awsLambdaSpan.close({ endTime });
      writeTrace();
      debugLog(
        'Overhead duration: Internal response:',
        `${Math.round(Number(process.hrtime.bigint() - responseStartTime) / 1000000)}ms`
      );
    };
    const wrapAwsCallback =
      (someAwsCallback) =>
      (...args) => {
        closeInvocation(
          args[0] == null ? 'success' : 'error:handled',
          args[0] == null ? args[1] : args[0]
        );
        someAwsCallback(...args);
      };
    const originalDone = context.done;
    let contextDone = wrapAwsCallback(originalDone);
    context.done = contextDone;
    context.succeed = (result) => contextDone(null, result);
    context.fail = (err) => contextDone(err == null ? 'handled' : err);

    // TODO: Insert eventual request handling
    debugLog(
      'Overhead duration: Internal request:',
      `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
    );
    const eventualResult = originalHandler(event, context, wrapAwsCallback(awsCallback));
    if (!eventualResult) return eventualResult;
    if (typeof eventualResult.then !== 'function') return eventualResult;
    return Promise.resolve(eventualResult)
      .then(
        (result) => {
          closeInvocation('success', result);
          return result;
        },
        (error) => {
          closeInvocation('error:handled', error);
          throw error;
        }
      )
      .finally(() => {
        // AWS internally uses context methods to resolve promise result
        contextDone = originalDone;
      });
  };
};
