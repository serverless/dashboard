'use strict';

const { IAM } = require('@aws-sdk/client-iam');
const { Lambda } = require('@aws-sdk/client-lambda');
const { APIGateway } = require('@aws-sdk/client-api-gateway');
const { ApiGatewayV2 } = require('@aws-sdk/client-apigatewayv2');
const { SQS } = require('@aws-sdk/client-sqs');
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

const getAllRestApiIds = async (position = undefined) => {
  const result = await awsRequest(APIGateway, 'getRestApis', { limit: 500, position });
  const apiIds = result.items
    .filter(({ name }) => name.startsWith(`${basename}-`))
    .map(({ id }) => id);

  if (result.position) {
    apiIds.push(...Array.from(await getAllRestApiIds(result.position)));
  }
  return new Set(apiIds);
};
const deleteRestApis = async () => {
  await Promise.all(
    Array.from(await getAllRestApiIds(), async (restApiId) => {
      await awsRequest(APIGateway, 'deleteRestApi', { restApiId });
      log.notice('Deleted REST API %s', restApiId);
    })
  );
};

const getAllHttpApiIds = async (nextToken = undefined) => {
  const result = await awsRequest(ApiGatewayV2, 'getApis', {
    MaxResults: '100000000',
    NextToken: nextToken,
  });
  const apiIds = result.Items.filter(({ Name: name }) => name.startsWith(`${basename}-`)).map(
    ({ ApiId: id }) => id
  );

  if (result.NextToken) {
    apiIds.push(...Array.from(await getAllHttpApiIds(result.NextToken)));
  }
  return new Set(apiIds);
};
const deleteHttpApis = async () => {
  await Promise.all(
    Array.from(await getAllHttpApiIds(), async (apiId) => {
      await awsRequest(ApiGatewayV2, 'deleteApi', { ApiId: apiId });
      log.notice('Deleted HTTP API %s', apiId);
    })
  );
};

const getAllEventSourceMappings = async (nextMarker) => {
  const result = await awsRequest(Lambda, 'listEventSourceMappings', {
    MaxItems: 100,
    Marker: nextMarker,
  });
  const uuids = result.EventSourceMappings.filter(({ FunctionArn: functionArn }) =>
    functionArn.includes(`:${basename}-`)
  ).map(({ UUID: uuid }) => uuid);

  if (result.NextMarker) {
    uuids.push(...Array.from(await getAllEventSourceMappings(result.NextMarker)));
  }
  return new Set(uuids);
};
const deleteEventSourceMappings = async () => {
  await Promise.all(
    Array.from(await getAllEventSourceMappings(), async (uuid) => {
      await awsRequest(Lambda, 'deleteEventSourceMapping', { UUID: uuid });
      log.notice('Deleted event source mapping %s', uuid);
    })
  );
};

const getAllSqsQueues = async (nextToken) => {
  const result = await awsRequest(SQS, 'listQueues', {
    MaxResults: 1000,
    NextToken: nextToken,
  });
  const queueUrls = result.QueueUrls.filter((queueUrl) => queueUrl.includes(`/${basename}-`));

  if (result.NextToken) {
    queueUrls.push(...Array.from(await getAllSqsQueues(result.NextMarker)));
  }
  return new Set(queueUrls);
};
const deleteSqsQueues = async () => {
  await Promise.all(
    Array.from(await getAllSqsQueues(), async (queueUrl) => {
      await awsRequest(SQS, 'deleteQueue', { QueueUrl: queueUrl });
      log.notice('Deleted SQS queue %s', queueUrl.slice(queueUrl.lastIndexOf('/') + 1));
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

const deleteAllLayers = () =>
  Promise.all([
    deleteLayers(basename),
    deleteLayers(`${basename}-internal`),
    deleteLayers(`${basename}-external`),
  ]);

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
  const mode = options.mode || 'all';
  if (mode === 'all') {
    await Promise.all([
      deleteFunctions(),
      deleteRestApis(),
      deleteHttpApis(),
      deleteEventSourceMappings(),
      deleteSqsQueues(),
    ]);
  }
  await Promise.all([deleteAllLayers(), deleteRole()]);
};
