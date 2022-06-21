'use strict';

const { IAM } = require('@aws-sdk/client-iam');
const { Lambda } = require('@aws-sdk/client-lambda');
const { STS } = require('@aws-sdk/client-sts');
const log = require('log').get('test');
const awsRequest = require('../utils/aws-request');
const basename = require('./basename');

const getAllFunctionNames = async (marker = undefined) => {
  const result = await awsRequest(Lambda, 'listFunctions', {
    FunctionVersion: 'ALL',
    Marker: marker,
  });
  const functionNames = result.Functions.map(
    ({ FunctionName: functionName }) => functionName
  ).filter((functionName) => functionName.startsWith(`${basename}-`));

  if (result.NextMarker) {
    functionNames.push(...Array.from(await getAllFunctionNames(result.NextMarker)));
  }
  return new Set(functionNames);
};

const deleteFunctions = async () => {
  await Promise.all(
    Array.from(await getAllFunctionNames(), async (functionName) => {
      await awsRequest(Lambda, 'deleteFunction', { FunctionName: functionName });
      log.notice('Deleted function %s', functionName);
    })
  );
};

const deleteLayers = async () => {
  const layerVersions = (await awsRequest(Lambda, 'listLayerVersions', { LayerName: basename }))
    .LayerVersions;
  if (!layerVersions.length) return;

  const lastLayerVersion = layerVersions[0].Version;
  await Promise.all(
    Array.from(Array(lastLayerVersion).keys()).map(async (index) => {
      const versionNumber = index + 1;
      await awsRequest(Lambda, 'deleteLayerVersion', {
        LayerName: basename,
        VersionNumber: versionNumber,
      });
    })
  );

  log.notice('Deleted all versions of layer %s', basename);
};

const deleteRole = async () => {
  const policyArn = `arn:aws:iam::${
    (await awsRequest(STS, 'getCallerIdentity')).Account
  }:policy/${basename}`;

  try {
    await awsRequest(IAM, 'detachRolePolicy', { RoleName: basename, PolicyArn: policyArn });
    log.notice('Detached IAM policy %s from %s', policyArn, basename);
  } catch (error) {
    if (error.Code !== 'NoSuchEntity') throw error;
  }
  await Promise.all([
    awsRequest(IAM, 'deleteRole', { RoleName: basename }).then(
      () => {
        log.notice('Deleted IAM role %s', basename);
      },
      (error) => {
        if (error.Code === 'NoSuchEntity') return;
        throw error;
      }
    ),
    awsRequest(IAM, 'deletePolicy', { PolicyArn: policyArn }).then(
      () => {
        log.notice('Deleted IAM policy %s', policyArn);
      },
      (error) => {
        if (error.Code === 'NoSuchEntity') return;
        throw error;
      }
    ),
  ]);
};

module.exports = async (options = {}) => {
  log.notice('Cleanup %s', basename);
  if (!options.skipFunctionsCleanup) await deleteFunctions();
  await Promise.all([deleteLayers(), deleteRole()]);
};
