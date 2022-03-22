'use strict';

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
    value: '@serverless/aws-lambda-otel-extension-0.2.3',
    source: '@serverless/aws-lambda-otel-extension-0.2.3',
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

const EventType = {
  INVOKE: 'INVOKE',
  SHUTDOWN: 'SHUTDOWN',
};

const LOCAL_DEBUGGING_IP = '0.0.0.0';
const RECEIVER_NAME = 'sandbox';

const receiverAddress = () => {
  return process.env.AWS_SAM_LOCAL === 'true' ? LOCAL_DEBUGGING_IP : RECEIVER_NAME;
};

const SAVE_FILE = '/tmp/sls-save-log.json';
const SENT_FILE = '/tmp/sent-requests.json';

const RECEIVER_PORT = 4243;
const TIMEOUT_MS = 25; // Maximum time (in milliseconds) that a batch is buffered.
const MAX_BYTES = 262144; // Maximum size in bytes that the logs are buffered in memory.
const MAX_ITEMS = 1000; // Maximum number of events that are buffered in memory.

const SUBSCRIPTION_BODY = {
  destination: {
    protocol: 'HTTP',
    URI: `http://${RECEIVER_NAME}:${RECEIVER_PORT}`,
  },
  types: ['platform', 'function'],
  buffering: {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxItems: MAX_ITEMS,
  },
  schemaVersion: '2021-03-18',
};

module.exports = {
  SAVE_FILE,
  SENT_FILE,
  receiverAddress,
  RECEIVER_PORT,
  SUBSCRIPTION_BODY,
  EventType,
  resourceAttributes,
  measureAttributes,
};
