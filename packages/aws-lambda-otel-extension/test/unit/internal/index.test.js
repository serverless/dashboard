'use strict';

const { expect } = require('chai');
const http = require('http');
const path = require('path');
const { promisify } = require('util');
const unzip = promisify(require('zlib').unzip);
const isThenable = require('type/thenable/is');
const log = require('log').get('test');
const requireUncached = require('ncjsm/require-uncached');
const { OTEL_SERVER_PORT } = require('../../../opt/otel-extension/lib/helper');
const ensureNpmDependencies = require('../../../scripts/lib/ensure-npm-dependencies');

const fixturesDirname = path.resolve(__dirname, '../../fixtures');

const handleSuccess = async (handlerModuleName) => {
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
            resolve(
              (async () => {
                log.debug('logs: %o', logsQueue);
                // Validate eventData record for log metadata
                const logMetadata = logsQueue[0].record;
                expect(logMetadata.eventData['123']['telemetry.sdk.language']).to.equal('nodejs');
                expect(logMetadata.eventData['123']['telemetry.sdk.name']).to.equal(
                  'opentelemetry'
                );
                expect(logMetadata.eventData['123']['faas.name']).to.equal(functionName);

                // Validate trace record
                const reportLog = logsQueue[1].record.split('\t')[2];
                const reportCompressed = reportLog.slice(reportLog.indexOf('⚡.') + 2);
                const report = JSON.parse(
                  String(await unzip(Buffer.from(reportCompressed, 'base64')))
                );
                log.debug('report: %o', report);
                expect(report.function['telemetry.sdk.language']).to.equal('nodejs');
                expect(report.function['telemetry.sdk.name']).to.equal('opentelemetry');
                expect(report.function['faas.name']).to.equal(functionName);
                expect(report.function.error).to.equal(false);
              })()
            );
          }
        });
      }
    });
  });

  server.listen(OTEL_SERVER_PORT);

  try {
    await requireUncached(async () => {
      await require('../../../opt/otel-extension/internal');
      await new Promise((resolve, reject) => {
        const maybeThenable = require('../../../opt/otel-extension/internal/wrapper').handler(
          {},
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
    });

    return await deferredResultProcessing;
  } finally {
    server.close();
  }
};

describe('internal', () => {
  before(() => {
    ensureNpmDependencies('opt/otel-extension');
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_REGION = 'us-east-1';
    process.env.LAMBDA_TASK_ROOT = path.resolve(fixturesDirname, 'lambdas');
    process.env.LAMBDA_RUNTIME_DIR = path.resolve(fixturesDirname, 'runtime');
  });
  afterEach(() => {
    delete process.env._HANDLER;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete globalThis[
      Object.getOwnPropertySymbols(globalThis).find((symbol) =>
        symbol.description.includes('opentelemetry')
      )
    ];
  });

  it('should handle plain success invocation', async () => handleSuccess('callback-success'));
  it('should handle esbuild ESM bundle result', async () =>
    handleSuccess('esbuild-esm-callback-success'));
  it('should handle ESM module', async () => handleSuccess('esm-callback-success/index'));
});
