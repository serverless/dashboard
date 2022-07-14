'use strict';

const apiRequest = require('@serverless/utils/api-request');
const log = require('log').get('test');

const service = 'benchmark';
const stage = 'test';

const resolveIngestionData = async () => {
  const orgToken = process.env.SLS_ORG_TOKEN;
  const orgName = process.env.SLS_ORG_NAME;

  if (!orgToken) {
    log.warn('No SLS_ORG_TOKEN provided - reporting to ingestion server will not be benchmarked');
    return {};
  }
  if (!orgName) {
    log.warn('No SLS_ORG_NAME provided - reporting to ingestion server will not be benchmarked');
    return {};
  }
  const orgId = (await apiRequest(`/api/identity/orgs/name/${orgName}`)).orgId;

  const token = (
    await apiRequest(`/ingestion/kinesis/org/${orgId}/service/${service}/stage/${stage}`)
  ).token.accessToken;

  await apiRequest('/ingestion/kinesis/token', {
    method: 'PATCH',
    body: { orgId, serviceId: service, stage, token },
  });

  return { token, orgId };
};

module.exports = async (coreConfig, options) => {
  const memorySize = options.memorySize || 1024;
  const allBenchmarkVariantsConfig = new Map([
    [
      'bare',
      {
        configuration: {
          MemorySize: memorySize,
          Layers: [],
          Environment: { Variables: {} },
        },
      },
    ],
    [
      'externalOnly',
      {
        configuration: {
          MemorySize: memorySize,
          Environment: {
            Variables: {
              SLS_EXTENSION: JSON.stringify({ logs: { disabled: true } }),
              SLS_DEBUG_EXTENSION: '1',
            },
          },
          ...(coreConfig.layerExternalArn ? null : { Layers: [coreConfig.layerExternalArn] }),
        },
      },
    ],
    [
      'internalOnly',
      {
        configuration: {
          MemorySize: memorySize,
          Layers: [coreConfig.layerInternalArn],
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
              SLS_DEBUG_EXTENSION: '1',
              SLS_TEST_EXTENSION_INTERNAL_LOG: '1',
              SLS_TEST_EXTENSION_REPORT_DESTINATION: 'log',
            },
          },
        },
      },
    ],
    [
      'jsonLog',
      {
        configuration: {
          MemorySize: memorySize,
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
              SLS_DEBUG_EXTENSION: '1',
              SLS_TEST_EXTENSION_REPORT_TYPE: 'json',
              SLS_TEST_EXTENSION_REPORT_DESTINATION: 'log',
              SLS_EXTENSION: JSON.stringify({
                logs: { disabled: true },
              }),
            },
          },
        },
      },
    ],
    [
      'protoLog',
      {
        configuration: {
          MemorySize: memorySize,
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
              SLS_DEBUG_EXTENSION: '1',
              SLS_TEST_EXTENSION_REPORT_DESTINATION: 'log',
              SLS_EXTENSION: JSON.stringify({
                logs: { disabled: true },
              }),
            },
          },
        },
      },
    ],
  ]);

  const { token, orgId } = await resolveIngestionData();
  if (token) {
    allBenchmarkVariantsConfig.set('console', {
      configuration: {
        MemorySize: memorySize,
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
            SLS_DEBUG_EXTENSION: '1',
            SLS_PLATFORM_STAGE: process.env.SERVERLESS_PLATFORM_STAGE,
            SERVERLESS_PLATFORM_STAGE: process.env.SERVERLESS_PLATFORM_STAGE,
            SLS_EXTENSION: JSON.stringify({
              orgId,
              ingestToken: token,
              namespace: service,
              environment: stage,
              logs: { disabled: true },
            }),
          },
        },
      },
    });
  }

  return allBenchmarkVariantsConfig;
};
