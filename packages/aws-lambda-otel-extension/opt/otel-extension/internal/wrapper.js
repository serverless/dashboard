'use strict';

process.env._HANDLER = process.env._ORIGIN_HANDLER;
delete process.env._ORIGIN_HANDLER;

const handlerFunction = EvalError.$serverlessHandlerFunction;
delete EvalError.$serverlessHandlerFunction;

module.exports.handler = require('./aws-lambda-instrumentation')._instance._getPatchHandler(
  handlerFunction
);
