'use strict';

const apiRequest = require('@serverless/utils/api-request');
const backendUrl = require('@serverless/utils/lib/auth/urls').backend;
const log = require('log').get('test');

const ingestionServerUrl = `${backendUrl}/ingestion/kinesis`;
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
  const memorySize = options.memorySize || 128;
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
              SLS_OTEL_USER_SETTINGS: JSON.stringify({ logs: { disabled: true } }),
              DEBUG_SLS_OTEL_LAYER: '1',
            },
          },
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
              DEBUG_SLS_OTEL_LAYER: '1',
              TEST_DRY_LOG: '1',
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
              DEBUG_SLS_OTEL_LAYER: '1',
              SLS_OTEL_USER_SETTINGS: JSON.stringify({
                logs: { disabled: true },
                metrics: { outputType: 'json' },
                traces: { outputType: 'json' },
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
              DEBUG_SLS_OTEL_LAYER: '1',
              SLS_OTEL_USER_SETTINGS: JSON.stringify({
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
            DEBUG_SLS_OTEL_LAYER: '1',
            OTEL_RESOURCE_ATTRIBUTES: `sls_service_name=${service},sls_stage=${stage},sls_org_id=${orgId}`,
            SLS_OTEL_USER_SETTINGS: JSON.stringify({
              common: { destination: { requestHeaders: `serverless_token=${token}` } },
              logs: { disabled: true },
              metrics: { destination: `${ingestionServerUrl}/v1/metrics` },
              request: { destination: `${ingestionServerUrl}/v1/request-response` },
              response: { destination: `${ingestionServerUrl}/v1/request-response` },
              traces: { destination: `${ingestionServerUrl}/v1/traces` },
            }),
          },
        },
      },
    });
  }

  return allBenchmarkVariantsConfig;
};
