#!/usr/bin/env node

// Triggers internal extension flow against provided handler (pass handler name via CLI arguments)
// Useful for debugging issues locally with extra logs or Node.js debugger

'use strict';

require('essentials');
require('log-node')();

const path = require('path');
const isThenable = require('type/thenable/is');

const fixturesDirname = path.resolve(__dirname, '../fixtures');

const handlerModuleName = process.argv[2];

if (!handlerModuleName) throw new Error('Provide handler module name in argument');

const payload = {};

(async () => {
  process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
  process.env.AWS_REGION = 'us-east-1';
  process.env.LAMBDA_TASK_ROOT = path.resolve(fixturesDirname, 'lambdas');
  process.env.LAMBDA_RUNTIME_DIR = path.resolve(fixturesDirname, 'runtime');

  process.env._HANDLER = `${handlerModuleName}.handler`;
  const functionName = handlerModuleName.includes(path.sep)
    ? path.dirname(handlerModuleName)
    : handlerModuleName;
  process.env.AWS_LAMBDA_FUNCTION_NAME = functionName;

  await require('../../internal-extension');
  await new Promise((resolve, reject) => {
    const maybeThenable = require('../../internal-extension/wrapper').handler(
      payload,
      {
        awsRequestId: '123',
        functionName,
        invokedFunctionArn: `arn:aws:lambda:us-east-1:123456789012:function:${functionName}`,
        getRemainingTimeInMillis: () => 3000,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    if (isThenable(maybeThenable)) resolve(maybeThenable);
  });
})();
