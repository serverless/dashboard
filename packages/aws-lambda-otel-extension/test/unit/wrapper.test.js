'use strict';

const { expect } = require('chai');
const path = require('path');
const { promisify } = require('util');
const unzip = promisify(require('zlib').unzip);
const log = require('log').get('test');
const requireUncached = require('ncjsm/require-uncached');
const overwriteStdoutWrite = require('process-utils/override-stdout-write');

const lambdaFixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

describe('wrapper', () => {
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_REGION = 'us-east-1';
    process.env.LAMBDA_TASK_ROOT = lambdaFixturesDirname;
  });

  it('should handle plain success invocation', async () => {
    process.env._HANDLER = 'callback-success.handler';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'callback-success';
    let stdoutData = '';
    await overwriteStdoutWrite(
      (data) => (stdoutData += data),
      async () =>
        requireUncached(async () => {
          await require('../../opt/otel-extension/wrapper');
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
    const reportLog = stdoutData
      .split('\n')
      .find((logLine) => logLine.startsWith('SERVERLESS_ENTERPRISE'));
    const reportCompressed = JSON.parse(reportLog.slice(reportLog.indexOf('{'))).b;
    const report = JSON.parse(String(await unzip(Buffer.from(reportCompressed, 'base64'))));
    log.debug('result report: %o', report);
    expect(report.function['telemetry.sdk.language']).to.equal('nodejs');
    expect(report.function['telemetry.sdk.name']).to.equal('opentelemetry');
    expect(report.function['faas.name']).to.equal('callback-success');
    expect(report.function.error).to.equal(false);
  });
});
