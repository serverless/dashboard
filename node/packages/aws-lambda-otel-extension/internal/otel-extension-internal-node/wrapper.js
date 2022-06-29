// Warning: This file must not require any dependencies

'use strict';

process.env._HANDLER = process.env._ORIGIN_HANDLER;
delete process.env._ORIGIN_HANDLER;

if (!EvalError.$serverlessHandlerFunction && !EvalError.$serverlessHandlerDeferred) {
  const handlerError = EvalError.$serverlessHandlerModuleInitializationError;
  delete EvalError.$serverlessHandlerModuleInitializationError;
  throw handlerError;
}

const awsLambdaInstrumentation = EvalError.$serverlessAwsLambdaInstrumentation;
delete EvalError.$serverlessAwsLambdaInstrumentation;

const wrapOriginalHandler = (orignalHandler) => {
  let requestStartTime;
  let responseStartTime;
  let currentInvocationId = 0;
  let isResolved = false;
  const debugLog = (...args) => {
    if (process.env.DEBUG_SLS_OTEL_LAYER) process._rawDebug(...args);
  };

  const otelHandler = awsLambdaInstrumentation._instance._getPatchHandler(
    (event, context, otelCallback) => {
      const invocationId = currentInvocationId;
      debugLog(
        'Extension overhead duration: internal request:',
        `${Math.round(Number(process.hrtime.bigint() - requestStartTime) / 1000000)}ms`
      );

      const wrapOtelCallback =
        (someOtelCallback) =>
        (...args) => {
          // Callback invoked directly by Lambda logic, it'll invoke otel wrap callback
          if (invocationId !== currentInvocationId) return;
          if (isResolved) return;
          isResolved = true;
          if (!responseStartTime) responseStartTime = process.hrtime.bigint();
          someOtelCallback(...args);
        };
      const done = wrapOtelCallback(context.done);
      context.done = done;
      context.succeed = (result) => done(null, result);
      context.fail = (err) => done(err == null ? 'handled' : err);
      const result = orignalHandler(event, context, wrapOtelCallback(otelCallback));
      if (!result) return result;
      if (typeof result.then !== 'function') return result;
      return Promise.resolve(result).finally(() => {
        // Lambda logic resolved, passing result to otel wrapper
        if (invocationId !== currentInvocationId) return;
        if (isResolved) return;
        isResolved = true;
        if (!responseStartTime) responseStartTime = process.hrtime.bigint();
      });
    }
  );

  return (event, context, awsCallback) => {
    requestStartTime = process.hrtime.bigint();
    EvalError.$serverlessInvocationStart = Date.now();
    debugLog('Internal extension: Invocation');
    isResolved = false;
    const invocationId = ++currentInvocationId;
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
    const wrapAwsCallback =
      (someAwsCallback) =>
      (...args) => {
        // Callback invoked by Otel instrumentation after triggering response hook
        if (invocationId !== currentInvocationId) return;
        Promise.all([
          EvalError.$serverlessRequestHandlerPromise,
          EvalError.$serverlessResponseHandlerPromise,
        ]).finally(() => {
          process.nextTick(() => someAwsCallback(...args));
          logResponseDuration();
        });
      };
    const done = wrapAwsCallback(context.done);
    context.done = done;
    context.succeed = (result) => done(null, result);
    context.fail = (err) => done(err == null ? 'handled' : err);
    const result = otelHandler(event, context, wrapAwsCallback(awsCallback));
    if (!result) return result;
    if (typeof result.then !== 'function') return result;
    return Promise.resolve(result).finally(() => {
      // Otel response hook triggered, passing result to AWS
      if (invocationId !== currentInvocationId) return null;
      return Promise.all([
        EvalError.$serverlessRequestHandlerPromise,
        EvalError.$serverlessResponseHandlerPromise,
      ]).finally(logResponseDuration);
    });
  };
};

if (EvalError.$serverlessHandlerDeferred) {
  const handlerDeferred = EvalError.$serverlessHandlerDeferred;
  delete EvalError.$serverlessHandlerDeferred;
  module.exports = handlerDeferred.then((handlerModule) => {
    if (handlerModule == null) return handlerModule;

    const path = require('path');
    const handlerBasename = path.basename(process.env._HANDLER);
    const handlerModuleBasename = handlerBasename.slice(0, handlerBasename.indexOf('.'));

    const handlerPropertyPathTokens = handlerBasename
      .slice(handlerModuleBasename.length + 1)
      .split('.');
    const handlerFunctionName = handlerPropertyPathTokens.pop();
    let handlerContext = handlerModule;
    while (handlerPropertyPathTokens.length) {
      handlerContext = handlerContext[handlerPropertyPathTokens.shift()];
      if (handlerContext == null) return handlerModule;
    }
    const handlerFunction = handlerContext[handlerFunctionName];
    if (typeof handlerFunction !== 'function') return handlerModule;

    return { handler: wrapOriginalHandler(handlerFunction) };
  });
  return;
}

const originalHandler = EvalError.$serverlessHandlerFunction;
delete EvalError.$serverlessHandlerFunction;
module.exports.handler = wrapOriginalHandler(originalHandler);
