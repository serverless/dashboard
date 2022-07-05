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

const listLayerVersions = async (layerName, nextMarker = undefined) => {
  const response = await awsRequest(Lambda, 'listLayerVersions', {
    LayerName: layerName,
    Marker: nextMarker,
  });
  const result = response.LayerVersions.map(({ Version }) => Version);
  if (response.NextMarker) {
    return [...result, await listLayerVersions(layerName, response.NextMarker)];
  }
  return result;
};

const deleteLayers = async (layerName) => {
  const layerVersions = await listLayerVersions(layerName);
  await Promise.all(
    layerVersions.map(async (versionNumber) => {
      await awsRequest(Lambda, 'deleteLayerVersion', {
        LayerName: layerName,
        VersionNumber: versionNumber,
      });
      log.notice('Deleted %d version of the layer %s', versionNumber, layerName);
    })
  );
};

const deleteDefaultLayers = () => deleteLayers(basename);
const deleteInternalLayers = () => deleteLayers(`${basename}-internal`);
const deleteAllLayers = () => Promise.all([deleteDefaultLayers(), deleteInternalLayers()]);

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
  await Promise.all([deleteAllLayers(), deleteRole()]);
};
