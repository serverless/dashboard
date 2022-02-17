'use strict';

const { expect } = require('chai');

const path = require('path');
const fsp = require('fs').promises;
const { S3 } = require('@aws-sdk/client-s3');
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const streamToPromise = require('stream-promise/to-promise');
const log = require('log').get('test');
const buildLayer = require('../../scripts/build/build');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');
const normalizeOtelAttributes = require('../utils/normalize-otel-attributes');

const nameTimeBase = new Date(2022, 1, 17).getTime();
const layerFilename = path.resolve(__dirname, '../../dist/extension.zip');
const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

describe('integration', function () {
  this.timeout(30000);
  let name;
  let s3;
  let lambda;
  let iam;
  let layerArn;
  let policyArn;
  let lambdasCodeZipBuffer;
  let roleArn;

  const processFunction = async (handlerName) => {
    const functionName = `${name}-${handlerName}`;
    const createFunction = async () => {
      try {
        await lambda.createFunction({
          Code: {
            ZipFile: lambdasCodeZipBuffer,
          },
          FunctionName: functionName,
          Handler: `${handlerName}.handler`,
          Role: roleArn,
          Runtime: 'nodejs14.x',
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension/otel-handler',
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
          error.message.includes('The role defined for the function cannot be assumed by Lambda') ||
          error.message.includes('because the KMS key is invalid for CreateGrant')
        ) {
          // Occassional race condition issue on AWS side, retry
          await createFunction();
          return;
        }
        throw error;
      }
    };
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

    await createFunction();
    await ensureIsActive();
    await invokeFunction();
    await invokeFunction();
    await deleteFunction();

    let objects;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      objects = ((await s3.listObjectsV2({ Bucket: name })).Contents || [])
        .map((object) => object.Key)
        .filter((key) => key.startsWith(`${functionName}/`));
    } while (!objects.length);
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

    const createBucket = async () => s3.createBucket({ Bucket: name });
    const createLayer = async () => {
      await buildLayer();

      await lambda.publishLayerVersion({
        LayerName: name,
        Content: { ZipFile: await fsp.readFile(layerFilename) },
      });
      layerArn = (await lambda.listLayerVersions({ LayerName: name })).LayerVersions.shift()
        .LayerVersionArn;
    };
    const createRole = async () => {
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
      await iam.attachRolePolicy({ RoleName: name, PolicyArn: policyArn });
    };
    [lambdasCodeZipBuffer] = await Promise.all([
      resolveDirZipBuffer(fixturesDirname),
      createBucket(),
      createLayer(),
      createRole(),
    ]);
  });

  describe('callback-success', () => {
    let reports;
    before(async () => {
      reports = await processFunction('callback-success');
      log.debug('resolved reports %o', reports);
    });
    it('test', () => {
      const [[metricsReport], [tracesReport]] = reports;
      const resourceMetrics = normalizeOtelAttributes(
        metricsReport.resourceMetrics[0].resource.attributes
      );
      expect(resourceMetrics['faas.name']).to.equal(`${name}-callback-success`);
      const resourceSpans = normalizeOtelAttributes(
        tracesReport.resourceSpans[0].resource.attributes
      );
      expect(resourceSpans['faas.name']).to.equal(`${name}-callback-success`);
    });
  });

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
