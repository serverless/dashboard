'use strict';

const { expect } = require('chai');

const path = require('path');
const wait = require('timers-ext/promise/sleep');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const { Lambda } = require('@aws-sdk/client-lambda');
const log = require('log').get('test');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const normalizeOtelAttributes = require('../utils/normalize-otel-attributes');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');
const awsRequest = require('./aws-request');
const basename = require('./basename');
const cleanup = require('./cleanup');
const createCoreResources = require('./create-core-resources');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

describe('integration', function () {
  this.timeout(120000);
  const config = {};
  let lambdasCodeZipBuffer;

  const functionsConfig = new Map([
    ['success-callback', true],
    ['success-callback-esbuild-from-esm', true],
    ['success-callback-esm/index', true],
    [
      'success-callback-express',
      {
        invocationOptions: {
          payload: {
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
          },
        },
        test: ({ instrumentationSpans }) => {
          expect(
            instrumentationSpans['@opentelemetry/instrumentation-express'].length
          ).to.be.at.least(4);
        },
      },
    ],
    [
      'error-timeout',
      {
        invocationOptions: { isFailure: true },
        // On timeout re-initialization of external extension gets slow, and we observe that second
        // invocation times out before actually lambda is initialized.
        // This is either because currently our external extension is Node.js based,
        // so has slow startup time, or it can be performance issue on AWS side.
        // To ensure reliable result increase timeout, so we get second invocation correct
        creationOptions: { configuration: { Timeout: 7 } },
        test: ({ instrumentationSpans }) => {
          const { attributes } =
            instrumentationSpans['@opentelemetry/instrumentation-aws-lambda'][0];
          expect(attributes['faas.error_exception_type']).to.equal('TimeoutError');
        },
      },
    ],
  ]);

  const processFunction = async (handlerModuleName, options = {}) => {
    const startTime = Date.now();
    const payload = options.payload || { foo: 'bar' };
    const functionBasename = handlerModuleName.includes(path.sep)
      ? path.dirname(handlerModuleName)
      : handlerModuleName;
    const functionName = `${basename}-${functionBasename}`;
    const ensureIsActive = async () => {
      const {
        Configuration: { State: state },
      } = await awsRequest(Lambda, 'getFunction', { FunctionName: functionName });
      if (state !== 'Active') await ensureIsActive();
    };
    const invokeFunction = async () => {
      const result = await awsRequest(Lambda, 'invoke', {
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(payload), 'utf8'),
      });
      try {
        const responsePayload = JSON.parse(Buffer.from(result.Payload));
        log.debug('invoke payload %O', responsePayload);
        log.debug('invoke parsed payload %O', JSON.parse(responsePayload.body));
      } catch {
        /* ignore */
      }
      if (result.FunctionError) {
        if (options.isFailure) return;
        throw new Error(`Invocation errored: ${result.FunctionError}`);
      }
    };
    const deleteFunction = async () => {
      await awsRequest(Lambda, 'deleteFunction', { FunctionName: functionName });
    };
    const resolveReportEvents = async () => {
      try {
        return (
          await awsRequest(CloudWatchLogs, 'filterLogEvents', {
            startTime,
            logGroupName: `/aws/lambda/${functionName}`,
          })
        ).events;
      } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
          log.info('log group not ready, wait and retry %s', functionBasename);
          await wait(1000);
          return resolveReportEvents();
        }
        throw error;
      }
    };

    log.info('Ensure function is active %s', functionBasename);
    await ensureIsActive();
    log.info('Invoke function #1 %s', functionBasename);
    await invokeFunction();
    log.info('Invoke function #2 %s', functionBasename);
    await invokeFunction();

    let reports;
    do {
      log.info('Retrieve list of written reports %s', functionBasename);
      const events = await resolveReportEvents();
      reports = [];
      let currentInvocationReports = [];
      for (const { message } of events) {
        if (message.startsWith('⚡')) {
          const reportType = message.slice(2, message.indexOf(':'));
          if (reportType === 'logs') continue;
          currentInvocationReports.push([
            reportType,
            JSON.parse(message.slice(message.indexOf(':') + 1).trim()),
          ]);
          continue;
        }
        if (message.startsWith('REPORT RequestId: ')) {
          reports.push(currentInvocationReports);
          currentInvocationReports = [];
        }
      }
    } while (reports.length < 2);

    log.info('Delete function %s', functionBasename);
    await deleteFunction();

    return reports;
  };

  before(async () => {
    ensureNpmDependencies('test/fixtures/lambdas');
    const createFunctions = async () => {
      await Promise.all(
        Array.from(functionsConfig, async function self([handlerModuleName, { creationOptions }]) {
          if (!creationOptions) creationOptions = {};
          const functionBasename = handlerModuleName.includes(path.sep)
            ? path.dirname(handlerModuleName)
            : handlerModuleName;
          const functionName = `${basename}-${functionBasename}`;
          log.info('Create function %s', functionBasename);
          try {
            await awsRequest(Lambda, 'createFunction', {
              Handler: `${handlerModuleName}.handler`,
              Role: config.roleArn,
              Runtime: 'nodejs14.x',
              ...creationOptions.configuration,
              Code: {
                ZipFile: lambdasCodeZipBuffer,
              },
              FunctionName: functionName,
              Layers: [config.layerArn],
              Environment: {
                Variables: {
                  AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
                  DEBUG_SLS_OTEL_LAYER: '1',
                  SLS_OTEL_USER_SETTINGS: JSON.stringify({
                    metrics: { outputType: 'json' },
                    traces: { outputType: 'json' },
                  }),
                },
              },
            });
          } catch (error) {
            if (
              error.message.includes(
                'The role defined for the function cannot be assumed by Lambda'
              ) ||
              error.message.includes('because the KMS key is invalid for CreateGrant')
            ) {
              // Occassional race condition issue on AWS side, retry
              await self([handlerModuleName, { creationOptions }]);
              return;
            }
            if (error.message.includes('Function already exist')) {
              log.notice('Function %s already exists, deleting and re-creating', functionBasename);
              await awsRequest(Lambda, 'deleteFunction', { FunctionName: functionName });
              await self([handlerModuleName, { creationOptions }]);
              return;
            }
            throw error;
          }
        })
      );
    };

    [lambdasCodeZipBuffer] = await Promise.all([
      resolveDirZipBuffer(fixturesDirname),
      createCoreResources(config),
    ]);
    await createFunctions();
  });

  for (const [handlerModuleName, { invocationOptions = {}, test }] of functionsConfig) {
    const functionBasename = handlerModuleName.includes(path.sep)
      ? path.dirname(handlerModuleName)
      : handlerModuleName;
    describe(functionBasename, () => {
      let reports;
      before(async () => {
        reports = await processFunction(handlerModuleName, invocationOptions);
        log.info('retrieved reposts %o', reports);
      });
      it('test', () => {
        if (!invocationOptions.isFailure) {
          // Current timeout handling is unreliable, therefore do not attempt to confirm
          // on all reports

          // While reports should come in order as specified below,
          // there were observed cases when it wasn't the case,
          // e.g. telemetryData (response) was received before eventData (request)
          expect(
            reports.map((invocationReports) => invocationReports.map(([type]) => type).sort())
          ).to.deep.equal([
            ['request', 'response', 'metrics', 'traces'].sort(),
            ['metrics', 'request', 'response', 'metrics', 'traces'].sort(),
          ]);
        }
        const allReports = reports.flat();
        const metricsReport = allReports.find(([reportType]) => reportType === 'metrics')[1];
        const tracesReport = allReports.find(([reportType]) => reportType === 'traces')[1];
        const resourceMetrics = normalizeOtelAttributes(
          metricsReport.resourceMetrics[0].resource.attributes
        );
        expect(resourceMetrics['faas.name']).to.equal(`${basename}-${functionBasename}`);
        const resourceSpans = normalizeOtelAttributes(
          tracesReport.resourceSpans[0].resource.attributes
        );
        expect(resourceSpans['faas.name']).to.equal(`${basename}-${functionBasename}`);

        const instrumentationSpans = {};
        for (const {
          instrumentationLibrary: { name },
          spans,
        } of tracesReport.resourceSpans[0].instrumentationLibrarySpans) {
          instrumentationSpans[name] = spans.map((span) => ({
            ...span,
            attributes: normalizeOtelAttributes(span.attributes),
          }));
        }
        log.debug('instrumentationSpans %o', instrumentationSpans);
        if (test) {
          test({
            metricsReport,
            tracesReport,
            resourceMetrics,
            resourceSpans,
            instrumentationSpans,
          });
        }
      });
    });
  }

  after(async () => cleanup({ skipFunctionsCleanup: true }));
});
