// Decorate original handler with Serverless SDK instrumentation

'use strict';

const debugLog = (...args) => {
  if (process.env.SLS_SDK_DEBUG) process._rawDebug('⚡ SDK:', ...args);
};

module.exports = (originalHandler) => {
  let currentInvocationId = 0;

  return (event, context, awsCallback) => {
    const requestStartTime = process.hrtime.bigint();
    EvalError.$serverlessInvocationStart = Date.now();
    debugLog('Invocation: start');
    let isResolved = false;
    let responseStartTime;
    isResolved = false;
    const invocationId = ++currentInvocationId;
    const logResponseDuration = () => {
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
        logResponseDuration();
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
        logResponseDuration();
      })
      .finally(() => {
        // AWS internally uses context methods to resolve promise result
        contextDone = originalDone;
      });
  };
};
