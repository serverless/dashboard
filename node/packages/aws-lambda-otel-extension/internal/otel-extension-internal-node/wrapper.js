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

const wrappedHandler = awsLambdaInstrumentation._instance._getPatchHandler(
  (event, context, callback) => {
    if (process.env.DEBUG_SLS_OTEL_LAYER) {
      process._rawDebug(
        'Extension overhead duration: internal request:',
        `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
      );
    }
    let isPromiseResult = false;
    const originalDone = context.done;
    const done = (...args) => {
      if (!isPromiseResult && !responseStartTime) responseStartTime = process.hrtime.bigint();
      return originalDone(...args);
    };
    context.done = done;
    context.succeed = (result) => done(null, result);
    context.fail = (err) => done(err == null ? 'handled' : err);
    const result = handlerFunction(event, context, (...args) => {
      if (!isPromiseResult && !responseStartTime) responseStartTime = process.hrtime.bigint();
      return callback(...args);
    });
    if (!result) return result;
    if (typeof result.then !== 'function') return result;
    isPromiseResult = true;
    return result.then(
      (asyncResult) => {
        if (!responseStartTime) responseStartTime = process.hrtime.bigint();
        return asyncResult;
      },
      (error) => {
        if (!responseStartTime) responseStartTime = process.hrtime.bigint();
        throw error;
      }
    );
  }
);

module.exports.handler = (event, context, callback) => {
  requestStartTime = process.hrtime.bigint();
  const logResponseDuration = () => {
    delete EvalError.$serverlessResponseHandlerPromise;
    if (process.env.DEBUG_SLS_OTEL_LAYER && responseStartTime) {
      process._rawDebug(
        'Extension overhead duration: internal response:',
        `${Math.round(Number(process.hrtime.bigint() - responseStartTime) / 1000000)}ms`
      );
      responseStartTime = null;
    }
  };
  let isPromiseResult = false;
  const originalDone = context.done;
  const done = (...args) => {
    if (!isPromiseResult && EvalError.$serverlessResponseHandlerPromise) {
      EvalError.$serverlessResponseHandlerPromise.finally(logResponseDuration);
    }
    return originalDone(...args);
  };
  context.done = done;
  context.succeed = (result) => done(null, result);
  context.fail = (err) => done(err == null ? 'handled' : err);
  const result = wrappedHandler(event, context, (...args) => {
    if (!isPromiseResult && EvalError.$serverlessResponseHandlerPromise) {
      EvalError.$serverlessResponseHandlerPromise.finally(logResponseDuration);
    }
    return callback(...args);
  });
  if (!result) return result;
  if (typeof result.then !== 'function') return result;
  isPromiseResult = true;
  return result.then(
    (asyncResult) => {
      logResponseDuration();
      return asyncResult;
    },
    (error) => {
      logResponseDuration();
      throw error;
    }
  );
};
