// This file is replaced with prebuilt bundle in actual extension layer

// Custom handler, runs original handler ensuring Serverless SDK instrumentation

'use strict';

process.env._HANDLER = process.env._ORIGIN_HANDLER;
delete process.env._ORIGIN_HANDLER;

if (!EvalError.$serverlessHandlerFunction && !EvalError.$serverlessHandlerDeferred) {
  const handlerError = EvalError.$serverlessHandlerModuleInitializationError;
  delete EvalError.$serverlessHandlerModuleInitializationError;
  throw handlerError;
}

const handlerDecorator = require('../handler-decorator');

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

    return { handler: handlerDecorator(handlerFunction) };
  });
  return;
}

const originalHandler = EvalError.$serverlessHandlerFunction;
delete EvalError.$serverlessHandlerFunction;

module.exports.handler = handlerDecorator(originalHandler);
