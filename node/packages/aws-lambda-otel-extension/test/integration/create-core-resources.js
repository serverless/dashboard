'use strict';

const path = require('path');
const fsp = require('fs').promises;
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const { STS } = require('@aws-sdk/client-sts');
const log = require('log').get('test');
const buildLayer = require('../../scripts/lib/build');
const awsRequest = require('./aws-request');
const basename = require('./basename');

const layerFilename = path.resolve(__dirname, '../../dist/extension.zip');

const createLayer = async (config) => {
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
  config.layerArn = (
    await awsRequest(Lambda, 'listLayerVersions', { LayerName: basename })
  ).LayerVersions.shift().LayerVersionArn;
  log.info('Layer ready %s', config.layerArn);
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

  await Promise.all([createLayer(config), createRole(config)]);
};
