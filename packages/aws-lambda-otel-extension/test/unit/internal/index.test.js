'use strict';

const { expect } = require('chai');
const http = require('http');
const path = require('path');
const isThenable = require('type/thenable/is');
const log = require('log').get('test');
const requireUncached = require('ncjsm/require-uncached');
const { OTEL_SERVER_PORT } = require('../../../opt/otel-extension/lib/helper');
const ensureNpmDependencies = require('../../../scripts/lib/ensure-npm-dependencies');

const fixturesDirname = path.resolve(__dirname, '../../fixtures');

const handleSuccess = async (handlerModuleName, payload = {}) => {
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
                const report = logsQueue[1].record;
                log.debug('report: %o', report);
                expect(report.function['telemetry.sdk.language']).to.equal('nodejs');
                expect(report.function['telemetry.sdk.name']).to.equal('opentelemetry');
                expect(report.function['faas.name']).to.equal(functionName);
                expect(report.function.error).to.equal(false);

                return report;
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
    });

    return await deferredResultProcessing;
  } finally {
    server.close();
  }
};

describe('internal', () => {
  before(() => {
    ensureNpmDependencies('opt/otel-extension');
    ensureNpmDependencies('test/fixtures/lambdas');
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
  it('should handle "express" handler', async () => {
    const report = await handleSuccess('express-app', {
      version: '2.0',
      routeKey: '$default',
      rawPath: '/',
      rawQueryString: '',
      headers: {
        'accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,pl;q=0.7,en;q=0.3',
        'content-length': '0',
        'host': '1hqnqp4a70.execute-api.us-east-1.amazonaws.com',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'sec-gpc': '1',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0',
        'x-amzn-trace-id': 'Root=1-624605c4-7fcc8fe9188a3cb762dcd189',
        'x-forwarded-for': '80.55.87.22',
        'x-forwarded-port': '443',
        'x-forwarded-proto': 'https',
      },
      requestContext: {
        accountId: '992311060759',
        apiId: '1hqnqp4a70',
        domainName: '1hqnqp4a70.execute-api.us-east-1.amazonaws.com',
        domainPrefix: '1hqnqp4a70',
        http: {
          method: 'GET',
          path: '/',
          protocol: 'HTTP/1.1',
          sourceIp: '80.55.87.22',
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0',
        },
        requestId: 'P3XWwjfgIAMEVFw=',
        routeKey: '$default',
        stage: '$default',
        time: '31/Mar/2022:19:49:24 +0000',
        timeEpoch: 1648756164620,
      },
      isBase64Encoded: false,
    });

    const expressSpans = report.traces.resourceSpans[0].instrumentationLibrarySpans.find(
      ({ instrumentationLibrary: { name } }) => name === '@opentelemetry/instrumentation-express'
    );

    expect(expressSpans.spans.length).to.be.at.least(4);
  });
});
