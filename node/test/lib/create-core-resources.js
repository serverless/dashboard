'use strict';

const path = require('path');
const fsp = require('fs').promises;
const camelToHyphen = require('ext/string_/camel-to-hyphen');
const capitalize = require('ext/string_/capitalize');
const { Lambda } = require('@aws-sdk/client-lambda');
const { IAM } = require('@aws-sdk/client-iam');
const { STS } = require('@aws-sdk/client-sts');
const log = require('log').get('test');
const awsRequest = require('../utils/aws-request');

const hyphentToUpperSnake = (str) => str.toUpperCase().replace(/-/g, '_');

module.exports = async (basename, config, options = {}) => {
  log.notice('Creating core resources %s', basename);
  config.accountId = (await awsRequest(STS, 'getCallerIdentity')).Account;

  const createLayer = async (name, layerConfig) => {
    const hyphenName = camelToHyphen.call(name);
    const filename = await (async () => {
      const envVarName = `TEST_LAYER_${hyphentToUpperSnake(hyphenName)}_FILENAME`;
      if (process.env[envVarName]) return path.resolve(process.env[envVarName]);
      if (layerConfig.filename) return layerConfig.filename;
      return layerConfig.build();
    })();
    log.info('Publishing layer (%s) to AWS', filename);
    const arn = (
      await awsRequest(Lambda, 'publishLayerVersion', {
        LayerName: `${basename}-${hyphenName}`,
        Content: { ZipFile: await fsp.readFile(filename) },
      })
    ).LayerVersionArn;
    config[`layer${capitalize.call(hyphenName)}Arn`] = arn;
    log.info('Layer ready %s', arn);
  };

  const createRole = async () => {
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
              Action: '*',
              Resource: '*',
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
  await Promise.all([
    Promise.all(
      Array.from(options.layersConfig, ([name, layerConfig]) => createLayer(name, layerConfig))
    ),
    createRole(config),
  ]);
};
