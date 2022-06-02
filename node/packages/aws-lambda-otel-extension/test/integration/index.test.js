'use strict';

const { expect } = require('chai');

const path = require('path');
const fsp = require('fs').promises;
const wait = require('timers-ext/promise/sleep');
const awsRequestBare = require('@serverless/test/aws-request');
const { S3 } = require('@aws-sdk/client-s3');
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const streamToPromise = require('stream-promise/to-promise');
const log = require('log').get('test');
const buildLayer = require('../../scripts/lib/build');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const normalizeOtelAttributes = require('../utils/normalize-otel-attributes');
const ensureNpmDependencies = require('../../scripts/lib/ensure-npm-dependencies');

const nameTimeBase = new Date(2022, 1, 17).getTime();
const layerFilename = path.resolve(__dirname, '../../dist/extension.zip');
const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');
const hasFailed = require('@serverless/test/has-failed');

const awsClientParams = { region: process.env.AWS_REGION };
const awsRequest = (client, method, args) =>
  awsRequestBare({ client, params: awsClientParams }, method, args);

describe('integration', function () {
  this.timeout(120000);
  let basename;
  let layerArn;
  let policyArn;
  let lambdasCodeZipBuffer;
  let roleArn;

  const functionsConfig = new Map([
    ['callback-success', true],
    ['esbuild-esm-callback-success', true],
    ['esm-callback-success/index', true],
    [
      'express-app',
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

    log.info('Ensure function is active %s', functionBasename);
    await ensureIsActive();
    log.info('Invoke function %s', functionBasename);
    await invokeFunction();

    let objects;
    do {
      log.info('Invoke function again %s', functionBasename);
      await invokeFunction();
      await wait(1000);
      log.info('Retrieve list of generated S3 objects %s', functionBasename);
      objects = ((await awsRequest(S3, 'listObjectsV2', { Bucket: basename })).Contents || [])
        .map((object) => object.Key)
        .filter((key) => key.startsWith(`${functionName}/`));
    } while (objects.length < 3);

    log.info('Delete function %s', functionBasename);
    await deleteFunction();
    log.info('Retrieve body of generated S3 objects %s', functionBasename);
    return Promise.all(
      objects.map(async (objectKey) => {
        const result = JSON.parse(
          String(
            await streamToPromise(
              (
                await awsRequest(S3, 'getObject', { Bucket: basename, Key: objectKey })
              ).Body
            )
          )
        );
        log.info('Report for %s: %o', objectKey, result);
        return result;
      })
    );
  };

  before(async () => {
    ensureNpmDependencies('test/fixtures/lambdas');
    basename = `test-otel-extension-${(Date.now() - nameTimeBase).toString(32)}`;
    log.notice('Creating %s', basename);

    const createBucket = async () => {
      log.info('Creating bucket %s', basename);
      await awsRequest(S3, 'createBucket', { Bucket: basename });
      log.info('Created bucket %s', basename);
    };
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
      log.info('Layer ready');
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
              {
                Effect: 'Allow',
                Action: ['s3:PutObject'],
                Resource: `arn:aws:s3:::${basename}/*`,
              },
            ],
          }),
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
                  SLS_OTEL_USER_SETTINGS: JSON.stringify({
                    metrics: { outputType: 'json', destination: `s3://${basename}` },
                    traces: { outputType: 'json', destination: `s3://${basename}` },
                  }),
                  OTEL_LOG_LEVEL: 'ALL',
                  DEBUG_SLS_OTEL_LAYER: '1',
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
      createBucket(),
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
      });
      it('test', () => {
        const metricsReport = reports.find((report) => report.resourceMetrics);
        const tracesReport = reports.find((report) => report.resourceSpans);
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
    const deleteBucket = async () => {
      const objects = (
        (await awsRequest(S3, 'listObjectsV2', { Bucket: basename })).Contents || []
      ).map((object) => ({
        Key: object.Key,
      }));
      if (objects.length) {
        await awsRequest(S3, 'deleteObjects', { Bucket: basename, Delete: { Objects: objects } });
      }
      await awsRequest(S3, 'deleteBucket', { Bucket: basename });
    };
    const deleteLayer = async () =>
      awsRequest(Lambda, 'deleteLayerVersion', { LayerName: basename, VersionNumber: 1 });
    const deleteRole = async () => {
      await awsRequest(IAM, 'detachRolePolicy', { RoleName: basename, PolicyArn: policyArn });
      return Promise.all([
        awsRequest(IAM, 'deleteRole', { RoleName: basename }),
        awsRequest(IAM, 'deletePolicy', { PolicyArn: policyArn }),
      ]);
    };
    await Promise.all([deleteBucket(), deleteLayer(), deleteRole()]);
  });
});
