'use strict';

const { expect } = require('chai');

const path = require('path');
const fsp = require('fs').promises;
const wait = require('timers-ext/promise/sleep');
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

describe('integration', function () {
  this.timeout(120000);
  let basename;
  let s3;
  let lambda;
  let iam;
  let layerArn;
  let policyArn;
  let lambdasCodeZipBuffer;
  let roleArn;

  const basicHandlerModuleNames = [
    'callback-success',
    'esbuild-esm-callback-success',
    'esm-callback-success/index',
  ];

  const processFunction = async (handlerModuleName, payload = { foo: 'bar' }) => {
    const functionBasename = handlerModuleName.includes(path.sep)
      ? path.dirname(handlerModuleName)
      : handlerModuleName;
    const functionName = `${basename}-${functionBasename}`;
    const ensureIsActive = async () => {
      const {
        Configuration: { State: state },
      } = await lambda.getFunction({ FunctionName: functionName });
      if (state !== 'Active') await ensureIsActive();
    };
    const invokeFunction = async () => {
      await lambda.invoke({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(payload), 'utf8'),
      });
    };
    const deleteFunction = async () => {
      await lambda.deleteFunction({ FunctionName: functionName });
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
      objects = ((await s3.listObjectsV2({ Bucket: basename })).Contents || [])
        .map((object) => object.Key)
        .filter((key) => key.startsWith(`${functionName}/`));
    } while (!objects.length);

    log.info('Delete function %s', functionBasename);
    await deleteFunction();
    log.info('Retrieve body of generated S3 objects %s', functionBasename);
    return Promise.all(
      objects.map(async (objectKey) =>
        JSON.parse(
          String(
            await streamToPromise((await s3.getObject({ Bucket: basename, Key: objectKey })).Body)
          )
        )
      )
    );
  };

  before(async () => {
    ensureNpmDependencies('test/fixtures/lambdas');
    basename = `test-otel-extension-${(Date.now() - nameTimeBase).toString(32)}`;
    log.notice('Creating %s', basename);
    s3 = new S3({ region: process.env.AWS_REGION });
    lambda = new Lambda({ region: process.env.AWS_REGION });
    iam = new IAM({ region: process.env.AWS_REGION });

    const createBucket = async () => {
      log.info('Creating bucket %s', basename);
      await s3.createBucket({ Bucket: basename });
      log.info('Created bucket %s', basename);
    };
    const createLayer = async () => {
      if (!process.env.TEST_LAYER_FILENAME) {
        log.info('Building layer');
        await buildLayer(layerFilename);
      }

      log.info('Publishing layer (%s) to AWS', process.env.TEST_LAYER_FILENAME || layerFilename);
      await lambda.publishLayerVersion({
        LayerName: basename,
        Content: { ZipFile: await fsp.readFile(process.env.TEST_LAYER_FILENAME || layerFilename) },
      });
      log.info('Resolving layer ARN');
      layerArn = (await lambda.listLayerVersions({ LayerName: basename })).LayerVersions.shift()
        .LayerVersionArn;
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
        iam.createRole({
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
        iam.createPolicy({
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
      await iam.attachRolePolicy({ RoleName: basename, PolicyArn: policyArn });
      log.info('Attached IAM policy to role');
    };

    const createFunctions = async () => {
      await Promise.all(
        [...basicHandlerModuleNames, 'express-app'].map(async function self(handlerModuleName) {
          const functionBasename = handlerModuleName.includes(path.sep)
            ? path.dirname(handlerModuleName)
            : handlerModuleName;
          const functionName = `${basename}-${functionBasename}`;
          log.info('Create function %s', functionBasename);
          try {
            await lambda.createFunction({
              Code: {
                ZipFile: lambdasCodeZipBuffer,
              },
              FunctionName: functionName,
              Handler: `${handlerModuleName}.handler`,
              Role: roleArn,
              Runtime: 'nodejs14.x',
              Environment: {
                Variables: {
                  AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension/internal/exec-wrapper.sh',
                  SLS_OTEL_REPORT_TYPE: 'json',
                  SLS_OTEL_REPORT_S3_BUCKET: basename,
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

  for (const handlerModuleName of basicHandlerModuleNames) {
    const functionBasename = handlerModuleName.includes(path.sep)
      ? path.dirname(handlerModuleName)
      : handlerModuleName;
    describe(functionBasename, () => {
      let reports;
      before(async () => {
        reports = await processFunction(handlerModuleName);
        log.debug('resolved reports %o', reports);
      });
      it('test', () => {
        const metricsReport = reports.find((reportArr) => !!('resourceMetrics' in reportArr[0]))[0];
        const tracesReport = reports.find((reportArr) => !!('resourceSpans' in reportArr[0]))[0];
        const resourceMetrics = normalizeOtelAttributes(
          metricsReport.resourceMetrics[0].resource.attributes
        );
        expect(resourceMetrics['faas.name']).to.equal(`${basename}-${functionBasename}`);
        const resourceSpans = normalizeOtelAttributes(
          tracesReport.resourceSpans[0].resource.attributes
        );
        expect(resourceSpans['faas.name']).to.equal(`${basename}-${functionBasename}`);
      });
    });
  }

  describe('express-app', () => {
    let reports;
    const handlerModuleName = 'express-app';
    before(async () => {
      reports = await processFunction(handlerModuleName, {
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
      log.debug('resolved reports %o', reports);
    });
    it('test', () => {
      const metricsReport = reports.find((reportArr) => !!('resourceMetrics' in reportArr[0]))[0];
      const tracesReport = reports.find((reportArr) => !!('resourceSpans' in reportArr[0]))[0];
      const resourceMetrics = normalizeOtelAttributes(
        metricsReport.resourceMetrics[0].resource.attributes
      );
      expect(resourceMetrics['faas.name']).to.equal(`${basename}-${handlerModuleName}`);
      const resourceSpans = normalizeOtelAttributes(
        tracesReport.resourceSpans[0].resource.attributes
      );
      expect(resourceSpans['faas.name']).to.equal(`${basename}-${handlerModuleName}`);

      const expressSpans = tracesReport.resourceSpans[0].instrumentationLibrarySpans.find(
        ({ instrumentationLibrary: { name } }) => name === '@opentelemetry/instrumentation-express'
      );

      expect(expressSpans.spans.length).to.be.at.least(4);
    });
  });

  after(async () => {
    const deleteBucket = async () => {
      const objects = ((await s3.listObjectsV2({ Bucket: basename })).Contents || []).map(
        (object) => ({
          Key: object.Key,
        })
      );
      if (objects.length) {
        await s3.deleteObjects({ Bucket: basename, Delete: { Objects: objects } });
      }
      await s3.deleteBucket({ Bucket: basename });
    };
    const deleteLayer = async () =>
      lambda.deleteLayerVersion({ LayerName: basename, VersionNumber: 1 });
    const deleteRole = async () => {
      await iam.detachRolePolicy({ RoleName: basename, PolicyArn: policyArn });
      return Promise.all([
        iam.deleteRole({ RoleName: basename }),
        iam.deletePolicy({ PolicyArn: policyArn }),
      ]);
    };
    await Promise.all([deleteBucket(), deleteLayer(), deleteRole()]);
  });
});
