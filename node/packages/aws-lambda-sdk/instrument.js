// Decorate original handler with Serverless SDK instrumentation

'use strict';

const ensurePlainFunction = require('type/plain-function/ensure');

const { traceSpans } = global.serverlessSdk || require('./');

const debugLog = (...args) => {
  if (process.env.SLS_SDK_DEBUG) process._rawDebug('⚡ SDK:', ...args);
};

module.exports = (originalHandler) => {
  ensurePlainFunction(originalHandler, { name: 'originalHandler' });
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
      debugLog(
        'Trace:',
        JSON.stringify({ id: traceSpans.awsLambda.traceId, spans: traceSpans.awsLambda.spans })
      );
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
