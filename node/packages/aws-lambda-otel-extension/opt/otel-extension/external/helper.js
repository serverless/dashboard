'use strict';
const isObject = require('lodash.isobject');

const extensionVersion = (() => {
  try {
    require.resolve('../version');
  } catch {
    return require('../../../package.json').version;
  }
  // eslint-disable-next-line import/no-unresolved
  return require('../version');
})();

const isJson = (data) => {
  try {
    JSON.parse(data);
    return true;
  } catch (error) {
    return null;
  }
};
const stripResponseBlobData = (data) => {
  const raw = data.responseData;

  if (!isObject(raw)) {
    delete data.responseData;
    return data;
  }
  if (typeof raw.body !== 'string') return data;
  if (!isJson(raw.body)) {
    delete raw.body;
    data.isBodyExcluded = true;
    return {
      ...data,
      responseData: JSON.stringify(raw),
    };
  }
  return data;
};

const resourceAttributes = [
  {
    key: 'faas.id',
    source: 'computeCustomArn',
    type: 'stringValue',
  },
  {
    key: 'faas.name',
    source: 'functionName',
    type: 'stringValue',
  },
  {
    key: 'cloud.region',
    source: 'computeRegion',
    type: 'stringValue',
  },
  {
    key: 'sls.application_name',
    source: 'sls_app_name',
    type: 'stringValue',
  },
  {
    key: 'sls.app_uid',
    source: 'sls_app_id',
    type: 'stringValue',
  },
  {
    key: 'service.namespace',
    source: 'sls_service_name',
    type: 'stringValue',
  },
  {
    key: 'deployment.environment',
    source: 'sls_stage',
    type: 'stringValue',
  },
  {
    key: 'sls.org_uid',
    source: 'sls_org_id',
    type: 'stringValue',
  },
  {
    key: 'service.name',
    source: 'functionName',
    type: 'stringValue',
  },
  {
    key: 'telemetry.sdk.language',
    source: 'computeRuntime',
    type: 'stringValue',
  },
  {
    key: 'telemetry.sdk.name',
    value: 'opentelemetry',
    source: 'opentelemetry',
    type: 'stringValue',
  },
  {
    key: 'telemetry.sdk.version',
    value: '1.0.1',
    source: 'version',
    type: 'stringValue',
  },
  {
    key: 'cloud.provider',
    value: 'aws',
    source: 'provider',
    type: 'stringValue',
  },
  {
    key: 'faas.version',
    source: 'computeCustomFunctionVersion',
    type: 'stringValue',
  },
  {
    key: 'sls.deployment_uid',
    source: 'sls_deploy_id',
    type: 'stringValue',
  },
  {
    key: 'cloud.account.id',
    source: 'eventCustomAccountId',
    type: 'stringValue',
  },
  {
    key: 'cloud.platform',
    value: 'lambda',
    source: 'opentelemetry',
    type: 'stringValue',
  },
  {
    key: 'faas.max_memory',
    source: 'computeMemorySize',
    type: 'stringValue',
  },
  {
    key: 'faas.log_group',
    source: 'computeCustomLogGroupName',
    type: 'stringValue',
  },
  {
    key: 'faas.log_stream_name',
    source: 'computeCustomLogStreamName',
    type: 'stringValue',
  },
  {
    key: 'faas.collector_version',
    value: `@serverless/aws-lambda-otel-extension@${extensionVersion}`,
    source: `@serverless/aws-lambda-otel-extension@${extensionVersion}`,
    type: 'stringValue',
  },
];

const measureAttributes = [
  {
    key: 'faas.coldstart',
    source: 'computeIsColdStart',
    type: 'boolValue',
  },
  {
    key: 'http.method',
    source: 'eventCustomHttpMethod',
    type: 'stringValue',
  },
  {
    key: 'http.raw_path',
    source: 'rawHttpPath',
    type: 'stringValue',
  },
  {
    key: 'http.domain',
    source: 'eventCustomDomain',
    type: 'stringValue',
  },
  {
    key: 'faas.error_exception_stacktrace',
    source: 'errorExceptionMessage',
    type: 'stringValue',
  },
  {
    key: 'faas.error_exception_message',
    source: 'errorExceptionStacktrace',
    type: 'stringValue',
  },
  {
    key: 'aws.xray.trace_id',
    source: 'eventCustomXTraceId',
    type: 'stringValue',
  },
  {
    key: 'faas.event_type',
    source: 'eventType',
    type: 'stringValue',
  },
  {
    key: 'faas.arch',
    source: 'computeCustomEnvArch',
    type: 'stringValue',
  },
  {
    key: 'faas.api_gateway_request_id',
    source: 'eventCustomRequestId',
    type: 'stringValue',
  },
  {
    key: 'faas.error_timeout',
    source: 'timeout',
    type: 'boolValue',
  },
  {
    key: 'faas.event_source',
    source: 'eventSource',
    type: 'stringValue',
  },
  {
    key: 'faas.api_gateway_app_id',
    source: 'eventCustomApiId',
    type: 'stringValue',
  },
  {
    key: 'faas.request_time_epoch',
    source: 'eventCustomRequestTimeEpoch',
    type: 'intValue',
  },
  {
    key: 'faas.error_culprit',
    source: 'errorCulprit',
    type: 'stringValue',
  },
  {
    key: 'faas.error_exception_type',
    source: 'errorExceptionType',
    type: 'stringValue',
  },
];

module.exports = {
  resourceAttributes,
  measureAttributes,
  stripResponseBlobData,
};
