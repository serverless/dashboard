#!/usr/bin/env node

// Triggers internal extension flow against provided handler (pass handler name via CLI arguments)
// Useful for debugging issues locally with extra logs or Node.js debugger

'use strict';

require('essentials');
require('log-node')();

const http = require('http');
const path = require('path');
const isThenable = require('type/thenable/is');
const log = require('log').get('test');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');

const fixturesDirname = path.resolve(__dirname, '../fixtures');

const OTEL_SERVER_PORT = 2772;
const handlerModuleName = process.argv[2];

if (!handlerModuleName) throw new Error('Provide handler module name in argument');

const payload = {};

(async () => {
  ensureNpmDependencies('internal/otel-extension-internal-node');
  ensureNpmDependencies('test/fixtures/lambdas');
  process.env.SLS_TEST_EXTENSION_REPORT_DESTINATION = 'log';
  process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
  process.env.AWS_REGION = 'us-east-1';
  process.env.LAMBDA_TASK_ROOT = path.resolve(fixturesDirname, 'lambdas');
  process.env.LAMBDA_RUNTIME_DIR = path.resolve(fixturesDirname, 'runtime');

  process.env._HANDLER = `${handlerModuleName}.handler`;
  const functionName = handlerModuleName.includes(path.sep)
    ? path.dirname(handlerModuleName)
    : handlerModuleName;
  process.env.AWS_LAMBDA_FUNCTION_NAME = functionName;

  const logsQueue = [];
  let server;
  const deferredResultProcessing = new Promise((resolve) => {
    server = http.createServer((request, response) => {
      if (request.method === 'POST') {
        let body = '';
        request.on('data', (data) => {
          body += data;
        });
        request.on('end', () => {
          response.writeHead(200, {});
          response.end('OK');
          const data = JSON.parse(body);
          logsQueue.push(data);

          if (logsQueue.length > 1) {
            server.close();
            resolve(logsQueue);
          }
        });
      }
    });
  });

  server.listen(OTEL_SERVER_PORT);

  try {
    const { keepAliveAgent } = await require('../../internal/otel-extension-internal-node');
    await new Promise((resolve, reject) => {
      const maybeThenable = require('../../internal/otel-extension-internal-node/wrapper').handler(
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

    const logs = await deferredResultProcessing;
    keepAliveAgent.destroy();
    log.info(logs);
  } finally {
    server.close();
  }
})();
