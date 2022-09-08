// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');
const isObject = require('type/object/is');
const isError = require('type/error/is');
const coerceToString = require('type/string/coerce');
const ensureString = require('type/string/ensure');
const traceProto = require('@serverless/sdk-schema/dist/trace');
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

module.exports = (originalHandler, options = {}) => {
  ensurePlainFunction(originalHandler, { name: 'originalHandler' });
  if (!isObject(options)) options = {};
  const orgId = ensureString(options.orgId, { isOptional: true, name: 'options.orgId' });
  if (orgId) serverlessSdk.orgId = orgId;
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
    traceSpans.awsLambdaInvocation = awsLambdaSpan.createSubSpan('aws.lambda.invocation', {
      startTime: requestStartTime,
    });
    resolveEventTags(event);

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
      }

      awsLambdaSpan.close();
      const trace = (serverlessSdk._lastTrace = {
        id: awsLambdaSpan.traceId,
        slsTags: {
          'orgId': serverlessSdk.orgId,
          'service': process.env.AWS_LAMBDA_FUNCTION_NAME,
          'sdk.name': pkgJson.name,
          'sdk.version': pkgJson.version,
        },
        spans: awsLambdaSpan.spans,
      });
      const protoTrace = (serverlessSdk._lastProtoTrace = {
        slsTags: {
          orgId: serverlessSdk.orgId,
          service: process.env.AWS_LAMBDA_FUNCTION_NAME,
          sdk: { name: pkgJson.name, version: pkgJson.version },
        },
        spans: Array.from(awsLambdaSpan.spans).map((span) => span.toProtobufObject()),
      });
      const protoTraceBuffer = (serverlessSdk._lastProtoTraceBuffer =
        traceProto.TracePayload.encode(protoTrace).finish());
      process._rawDebug(`SERVERLESS_TELEMETRY.T.${protoTraceBuffer.toString('base64')}`);

      debugLog('Trace:', JSON.stringify(trace));
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
