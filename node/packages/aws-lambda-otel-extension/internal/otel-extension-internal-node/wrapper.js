// Warning: This file must not require any dependencies

'use strict';

process.env._HANDLER = process.env._ORIGIN_HANDLER;
delete process.env._ORIGIN_HANDLER;

if (!EvalError.$serverlessHandlerFunction) {
  const handlerError = EvalError.$serverlessHandlerModuleInitializationError;
  delete EvalError.$serverlessHandlerModuleInitializationError;
  throw handlerError;
}

const handlerFunction = EvalError.$serverlessHandlerFunction;
delete EvalError.$serverlessHandlerFunction;
const awsLambdaInstrumentation = EvalError.$serverlessAwsLambdaInstrumentation;
delete EvalError.$serverlessAwsLambdaInstrumentation;

let requestStartTime;
let responseStartTime;
let currentInvocationId = 0;
const debugLog = (...args) => {
  if (process.env.DEBUG_SLS_OTEL_LAYER) process._rawDebug(...args);
};

const wrappedHandler = awsLambdaInstrumentation._instance._getPatchHandler(
  (event, context, callback) => {
    const invocationId = currentInvocationId;
    debugLog(
      'Extension overhead duration: internal request:',
      `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
    );

    const wrapCallback =
      (originalCallback) =>
      (...args) => {
        if (invocationId !== currentInvocationId) {
          originalCallback(...args);
          return;
        }
        if (!responseStartTime) responseStartTime = process.hrtime.bigint();
        originalCallback(...args);
      };
    const done = wrapCallback(context.done);
    context.done = done;
    context.succeed = (result) => done(null, result);
    context.fail = (err) => done(err == null ? 'handled' : err);
    const result = handlerFunction(event, context, wrapCallback(callback));
    if (!result) return result;
    if (typeof result.then !== 'function') return result;
    return Promise.resolve(result).finally(() => {
      if (invocationId !== currentInvocationId) return;
      if (!responseStartTime) responseStartTime = process.hrtime.bigint();
    });
  }
);

module.exports.handler = (event, context, callback) => {
  const invocationId = ++currentInvocationId;
  requestStartTime = process.hrtime.bigint();
  const logResponseDuration = () => {
    if (invocationId !== currentInvocationId) return;
    delete EvalError.$serverlessRequestHandlerPromise;
    delete EvalError.$serverlessResponseHandlerPromise;
    if (responseStartTime) {
      debugLog(
        'Extension overhead duration: internal response:',
        `${Math.round(Number(process.hrtime.bigint() - responseStartTime) / 1000000)}ms`
      );
      responseStartTime = null;
    }
  };
  const wrapCallback =
    (originalCallback) =>
    (...args) => {
      if (invocationId !== currentInvocationId) {
        originalCallback(...args);
        return;
      }
      Promise.all([
        EvalError.$serverlessRequestHandlerPromise,
        EvalError.$serverlessResponseHandlerPromise,
      ]).finally(() => {
        process.nextTick(() => originalCallback(...args));
        logResponseDuration();
      });
    };
  const done = wrapCallback(context.done);
  context.done = done;
  context.succeed = (result) => done(null, result);
  context.fail = (err) => done(err == null ? 'handled' : err);
  const result = wrappedHandler(event, context, wrapCallback(callback));
  if (!result) return result;
  if (typeof result.then !== 'function') return result;
  return Promise.resolve(result).finally(() => {
    if (invocationId !== currentInvocationId) return null;
    return Promise.all([
      EvalError.$serverlessRequestHandlerPromise,
      EvalError.$serverlessResponseHandlerPromise,
    ]).finally(logResponseDuration);
  });
};
