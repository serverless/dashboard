'use strict';

const { expect } = require('chai');

const path = require('path');
const fsp = require('fs').promises;
const wait = require('timers-ext/promise/sleep');
const { CloudWatchLogs } = require('@aws-sdk/client-cloudwatch-logs');
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const { STS } = require('@aws-sdk/client-sts');
const log = require('log').get('test');
const buildLayer = require('../../scripts/lib/build');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const normalizeOtelAttributes = require('../utils/normalize-otel-attributes');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');
const awsRequest = require('./aws-request');
const basename = require('./basename');
const cleanup = require('./cleanup');

const layerFilename = path.resolve(__dirname, '../../dist/extension.zip');
const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');
const hasFailed = require('@serverless/test/has-failed');

describe('integration', function () {
  this.timeout(120000);
  let layerArn;
  let policyArn;
  let lambdasCodeZipBuffer;
  let roleArn;

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
    log.notice('Creating %s', basename);

    const accountId = (await awsRequest(STS, 'getCallerIdentity')).Account;
    const createLayer = async () => {
      if (!process.env.TEST_LAYER_FILENAME) {
        log.info('Building layer');
        await buildLayer(layerFilename);
      }

      log.info('Publishing layer (%s) to AWS', process.env.TEST_LAYER_FILENAME || layerFilename);
      await awsRequest(Lambda, 'publishLayerVersion', {
        LayerName: basename,
        Content: { ZipFile: await fsp.readFile(process.env.TEST_LAYER_FILENAME || layerFilename) },
      });
      log.info('Resolving layer ARN');
      layerArn = (
        await awsRequest(Lambda, 'listLayerVersions', { LayerName: basename })
      ).LayerVersions.shift().LayerVersionArn;
      log.info('Layer ready %s', layerArn);
    };
    const createRole = async () => {
      log.info('Creating IAM role and policy');
      [
        {
          Role: { Arn: roleArn },
        },
        {
          Policy: { Arn: policyArn },
        },
      ] = await Promise.all([
        awsRequest(IAM, 'createRole', {
          RoleName: basename,
          AssumeRolePolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: ['lambda.amazonaws.com'] },
                Action: ['sts:AssumeRole'],
              },
            ],
          }),
        }).catch((error) => {
          if (error.Code === 'EntityAlreadyExists') {
            log.notice('IAM role already exists');
            return { Role: { Arn: `arn:aws:iam::${accountId}:role/${basename}` } };
          }
          throw error;
        }),
        awsRequest(IAM, 'createPolicy', {
          PolicyName: basename,
          PolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:CreateLogGroup'],
                Resource: `arn:*:logs:*:*:log-group:/aws/lambda/${basename}*:*`,
              },
              {
                Effect: 'Allow',
                Action: ['logs:PutLogEvents'],
                Resource: `arn:*:logs:*:*:log-group:/aws/lambda/${basename}*:*:*`,
              },
            ],
          }),
        }).catch((error) => {
          if (error.Code === 'EntityAlreadyExists') {
            log.notice('IAM policy already exists');
            return { Policy: { Arn: `arn:aws:iam::${accountId}:policy/${basename}` } };
          }
          throw error;
        }),
      ]);
      log.info('Attaching IAM policy to role');
      await awsRequest(IAM, 'attachRolePolicy', { RoleName: basename, PolicyArn: policyArn });
      log.info('Attached IAM policy to role');
    };

    const createFunctions = async () => {
      await Promise.all(
        Array.from(functionsConfig.keys()).map(async function self(handlerModuleName) {
          const functionBasename = handlerModuleName.includes(path.sep)
            ? path.dirname(handlerModuleName)
            : handlerModuleName;
          const functionName = `${basename}-${functionBasename}`;
          log.info('Create function %s', functionBasename);
          try {
            await awsRequest(Lambda, 'createFunction', {
              Code: {
                ZipFile: lambdasCodeZipBuffer,
              },
              FunctionName: functionName,
              Handler: `${handlerModuleName}.handler`,
              Role: roleArn,
              Runtime: 'nodejs14.x',
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
              Layers: [layerArn],
            });
          } catch (error) {
            if (
              error.message.includes(
                'The role defined for the function cannot be assumed by Lambda'
              ) ||
              error.message.includes('because the KMS key is invalid for CreateGrant')
            ) {
              // Occassional race condition issue on AWS side, retry
              await self(handlerModuleName);
              return;
            }
            throw error;
          }
        })
      );
    };

    [lambdasCodeZipBuffer] = await Promise.all([
      resolveDirZipBuffer(fixturesDirname),
      createLayer(),
      createRole(),
    ]);
    await createFunctions();
  });

  for (const [handlerModuleName, { invocationOptions, test }] of functionsConfig) {
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
        expect(
          reports.map((invocationReports) => invocationReports.map(([type]) => type))
        ).to.deep.equal([
          ['request', 'response', 'metrics', 'traces'],
          ['metrics', 'request', 'response', 'metrics', 'traces'],
        ]);
        const metricsReport = reports[0][2][1];
        const tracesReport = reports[0][3][1];
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

  after(async function () {
    if (hasFailed(this.test.parent)) return; // Avoid cleanup
    await cleanup({ skipFunctionsCleanup: true });
  });
});
