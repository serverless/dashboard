'use strict';

const { expect } = require('chai');
const http = require('http');
const path = require('path');
const { promisify } = require('util');
const unzip = promisify(require('zlib').unzip);
const log = require('log').get('test');
const requireUncached = require('ncjsm/require-uncached');
const overwriteStdoutWrite = require('process-utils/override-stdout-write');

const lambdaFixturesDirname = path.resolve(__dirname, '../../fixtures/lambdas');

describe('internal', () => {
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_REGION = 'us-east-1';
    process.env.LAMBDA_TASK_ROOT = lambdaFixturesDirname;
  });

  it('should handle plain success invocation', (done) => {
    process.env._HANDLER = 'callback-success.handler';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'callback-success';
    let stdoutData = '';

    let logsQueue = [];
    const server = http.createServer((request, response) => {
      if (request.method === 'POST') {
        let body = '';
        request.on('data', (data) => {
          body += data;
        });
        request.on('end', async () => {
          response.writeHead(200, {});
          response.end('OK');
          server.close();
          const batch = JSON.parse(body);
          logsQueue = batch;

          expect(logsQueue.length).to.equal(1);
          const reportLog = logsQueue[0].record.split('\t')[2];

          const reportCompressed = reportLog.slice(reportLog.indexOf('⚡.') + 2);
          const report = JSON.parse(String(await unzip(Buffer.from(reportCompressed, 'base64'))));
          log.debug('result report: %o', report);
          expect(report.function['telemetry.sdk.language']).to.equal('nodejs');
          expect(report.function['telemetry.sdk.name']).to.equal('opentelemetry');
          expect(report.function['faas.name']).to.equal('callback-success');
          expect(report.function.error).to.equal(false);
          done();
        });
      }
    });

    process.env.MOCK_PORT = 4123;
    server.listen(process.env.MOCK_PORT);

    overwriteStdoutWrite(
      (data) => (stdoutData += data),
      async () =>
        requireUncached(async () => {
          await require('../../../opt/otel-extension/internal');
          await new Promise((resolve) => {
            require(path.resolve(lambdaFixturesDirname, 'callback-success.js')).handler(
              {},
              {
                invokedFunctionArn:
                  'arn:aws:lambda:us-east-1:123456789012:function:callback-success',
                getRemainingTimeInMillis: () => 3000,
              },
              resolve
            );
          });
        })
    );
  });
});
