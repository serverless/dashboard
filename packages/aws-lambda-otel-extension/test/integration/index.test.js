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

const nameTimeBase = new Date(2022, 1, 17).getTime();
const layerFilename = path.resolve(__dirname, '../../dist/extension.zip');
const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

describe('integration', function () {
  this.timeout(120000);
  let name;
  let s3;
  let lambda;
  let iam;
  let layerArn;
  let policyArn;
  let lambdasCodeZipBuffer;
  let roleArn;

  const handlerModuleNames = [
    'callback-success',
    'esbuild-esm-callback-success',
    'esm-callback-success/index',
  ];

  const processFunction = async (handlerModuleName) => {
    const functionBasename = handlerModuleName.includes(path.sep)
      ? path.dirname(handlerModuleName)
      : handlerModuleName;
    const functionName = `${name}-${functionBasename}`;
    const ensureIsActive = async () => {
      const {
        Configuration: { State: state },
      } = await lambda.getFunction({ FunctionName: functionName });
      if (state !== 'Active') await ensureIsActive();
    };
    const invokeFunction = async () => {
      await lambda.invoke({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8'),
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
      objects = ((await s3.listObjectsV2({ Bucket: name })).Contents || [])
        .map((object) => object.Key)
        .filter((key) => key.startsWith(`${functionName}/`));
    } while (!objects.length);

    log.info('Delete function %s', functionBasename);
    await deleteFunction();
    log.info('Retrieve body of generated S3 objects %s', functionBasename);
    return Promise.all(
      objects.map(async (objectKey) =>
        JSON.parse(
          String(await streamToPromise((await s3.getObject({ Bucket: name, Key: objectKey })).Body))
        )
      )
    );
  };

  before(async () => {
    name = `test-otel-extension-${(Date.now() - nameTimeBase).toString(32)}`;
    log.notice('Creating %s', name);
    s3 = new S3({ region: process.env.AWS_REGION });
    lambda = new Lambda({ region: process.env.AWS_REGION });
    iam = new IAM({ region: process.env.AWS_REGION });

    const createBucket = async () => {
      log.info('Creating bucket %s', name);
      await s3.createBucket({ Bucket: name });
      log.info('Created bucket %s', name);
    };
    const createLayer = async () => {
      log.info('Building layer');
      await buildLayer(layerFilename, {
        shouldSkipNpmInstall: process.env.TEST_SKIP_LAYER_NPM_INSTALL,
      });

      log.info('Publishing layer to AWS');
      await lambda.publishLayerVersion({
        LayerName: name,
        Content: { ZipFile: await fsp.readFile(layerFilename) },
      });
      log.info('Resolving layer ARN');
      layerArn = (await lambda.listLayerVersions({ LayerName: name })).LayerVersions.shift()
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
          RoleName: name,
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
          PolicyName: name,
          PolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:CreateLogGroup'],
                Resource: `arn:*:logs:*:*:log-group:/aws/lambda/${name}*:*`,
              },
              {
                Effect: 'Allow',
                Action: ['logs:PutLogEvents'],
                Resource: `arn:*:logs:*:*:log-group:/aws/lambda/${name}*:*:*`,
              },
              {
                Effect: 'Allow',
                Action: ['s3:PutObject'],
                Resource: `arn:aws:s3:::${name}/*`,
              },
            ],
          }),
        }),
      ]);
      log.info('Attaching IAM policy to role');
      await iam.attachRolePolicy({ RoleName: name, PolicyArn: policyArn });
      log.info('Attached IAM policy to role');
    };

    const createFunctions = async () => {
      await Promise.all(
        handlerModuleNames.map(async function self(handlerModuleName) {
          const functionBasename = handlerModuleName.includes(path.sep)
            ? path.dirname(handlerModuleName)
            : handlerModuleName;
          const functionName = `${name}-${functionBasename}`;
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
                  SLS_OTEL_REPORT_S3_BUCKET: name,
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
              await self();
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

  for (const handlerModuleName of handlerModuleNames) {
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
        expect(resourceMetrics['faas.name']).to.equal(`${name}-${functionBasename}`);
        const resourceSpans = normalizeOtelAttributes(
          tracesReport.resourceSpans[0].resource.attributes
        );
        expect(resourceSpans['faas.name']).to.equal(`${name}-${functionBasename}`);
      });
    });
  }

  after(async () => {
    const deleteBucket = async () => {
      const objects = ((await s3.listObjectsV2({ Bucket: name })).Contents || []).map((object) => ({
        Key: object.Key,
      }));
      if (objects.length) {
        await s3.deleteObjects({ Bucket: name, Delete: { Objects: objects } });
      }
      await s3.deleteBucket({ Bucket: name });
    };
    const deleteLayer = async () =>
      lambda.deleteLayerVersion({ LayerName: name, VersionNumber: 1 });
    const deleteRole = async () => {
      await iam.detachRolePolicy({ RoleName: name, PolicyArn: policyArn });
      return Promise.all([
        iam.deleteRole({ RoleName: name }),
        iam.deletePolicy({ PolicyArn: policyArn }),
      ]);
    };
    await Promise.all([deleteBucket(), deleteLayer(), deleteRole()]);
  });
});
