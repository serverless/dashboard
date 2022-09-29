'use strict';

const path = require('path');
const fsp = require('fs').promises;
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const { STS } = require('@aws-sdk/client-sts');
const log = require('log').get('test');
const awsRequest = require('../utils/aws-request');
const basename = require('./basename');

const createLayer = async ({ layerName, filename }) => {
  log.info('Publishing layer (%s) to AWS', filename);
  const arn = (
    await awsRequest(Lambda, 'publishLayerVersion', {
      LayerName: layerName,
      Content: { ZipFile: await fsp.readFile(filename) },
    })
  ).LayerVersionArn;
  log.info('Layer ready %s', arn);
  return arn;
};

const createLayers = async (config, layerTypes) => {
  return Promise.all(
    Array.from(layerTypes, async (layerType) => {
      switch (layerType) {
        case 'nodeExternal':
          if (process.env.TEST_EXTERNAL_LAYER_FILENAME) {
            config.layerExternalArn = await createLayer({
              layerName: `${basename}-external`,
              filename: path.resolve(process.env.TEST_EXTERNAL_LAYER_FILENAME),
              skipBuild: true,
            });
            return;
          }
          config.layerExternalArn = await createLayer({
            layerName: `${basename}-external`,
            filename: path.resolve(
              __dirname,
              '../../../../../../go/packages/dev-mode/dist/extension.zip'
            ),
          });
          return;
        case 'nodeInternal':
          if (process.env.TEST_INTERNAL_LAYER_FILENAME) {
            config.layerInternalArn = await createLayer({
              layerName: `${basename}-internal`,
              filename: path.resolve(process.env.TEST_INTERNAL_LAYER_FILENAME),
              skipBuild: true,
            });
            return;
          }
          config.layerInternalArn = await createLayer({
            layerName: `${basename}-internal`,
            filename: path.resolve(
              __dirname,
              '../../../../../packages/aws-lambda-sdk/dist/extension.internal.zip'
            ),
          });
          return;
        default:
          throw new Error(`Unrecognized layer type: ${layerType}`);
      }
    })
  );
};

const createRole = async (config) => {
  log.info('Creating IAM role and policy');
  const [
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
        return { Role: { Arn: `arn:aws:iam::${config.accountId}:role/${basename}` } };
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
        return { Policy: { Arn: `arn:aws:iam::${config.accountId}:policy/${basename}` } };
      }
      throw error;
    }),
  ]);
  log.info('Attaching IAM policy to role');
  await awsRequest(IAM, 'attachRolePolicy', { RoleName: basename, PolicyArn: policyArn });
  log.info('Attached IAM policy to role');
  config.roleArn = roleArn;
  config.policyArn = policyArn;
};

module.exports = async (config) => {
  log.notice('Creating core resources %s', basename);
  config.accountId = (await awsRequest(STS, 'getCallerIdentity')).Account;

  await Promise.all([createLayers(config, ['nodeExternal', 'nodeInternal']), createRole(config)]);
};
