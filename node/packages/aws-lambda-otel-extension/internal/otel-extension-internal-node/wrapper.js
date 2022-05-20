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

module.exports.handler = require('./aws-lambda-instrumentation')._instance._getPatchHandler(
  handlerFunction
);
