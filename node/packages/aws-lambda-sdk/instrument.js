// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');
const isObject = require('type/object/is');
const ensureString = require('type/string/ensure');

const serverlessSdk = global.serverlessSdk || require('./');

const { traceSpans } = serverlessSdk;

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

  traceSpans.awsLambdaInitialization.close();
  return (event, context, awsCallback) => {
    const requestStartTime = process.hrtime.bigint();
    debugLog('Invocation: start');
    let isResolved = false;
    let responseStartTime;
    isResolved = false;
    const invocationId = ++currentInvocationId;
    if (invocationId > 1) {
      // Reset root span ids and startTime with every next invocation
      delete traceSpans.awsLambda.traceId;
      delete traceSpans.awsLambda.id;
      delete traceSpans.awsLambda.endTime;
      traceSpans.awsLambda.startTime = requestStartTime;
      traceSpans.awsLambda.subSpans.clear();
    }
    traceSpans.awsLambdaInvocation = traceSpans.awsLambda.createSubSpan('aws.lambda.invocation', {
      startTime: requestStartTime,
    });
    const closeInvocation = () => {
      traceSpans.awsLambda.close();
      const trace = (serverlessSdk._lastTrace = {
        id: traceSpans.awsLambda.traceId,
        slsTags: { orgId: serverlessSdk.orgId, service: process.env.AWS_LAMBDA_FUNCTION_NAME },
        spans: traceSpans.awsLambda.spans,
      });
      debugLog('Trace:', JSON.stringify(trace));
      debugLog(
        'Overhead duration: Internal response:',
        `${Math.round(Number(process.hrtime.bigint() - responseStartTime) / 1000000)}ms`
      );
    };
    const wrapAwsCallback =
      (someAwsCallback) =>
      (...args) => {
        // Callback invoked directly by Lambda logic, it'll invoke otel wrap callback
        if (invocationId !== currentInvocationId) return;
        if (isResolved) return;
        isResolved = true;
        responseStartTime = process.hrtime.bigint();
        // TODO: Insert eventual response processing
        process.nextTick(() => someAwsCallback(...args));
        closeInvocation();
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
    const result = originalHandler(event, context, wrapAwsCallback(awsCallback));
    if (!result) return result;
    if (typeof result.then !== 'function') return result;
    return Promise.resolve(result)
      .finally(() => {
        if (invocationId !== currentInvocationId) return;
        if (isResolved) return;
        isResolved = true;
        responseStartTime = process.hrtime.bigint();
        // TODO: Insert eventual response processing
        closeInvocation();
      })
      .finally(() => {
        // AWS internally uses context methods to resolve promise result
        contextDone = originalDone;
      });
  };
};
