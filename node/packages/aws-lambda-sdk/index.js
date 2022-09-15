'use strict';

const serverlessSdk = module.exports;

serverlessSdk.traceSpans = {
  awsLambda: require('./trace-spans/aws-lambda'),
  awsLambdaInitialization: require('./trace-spans/aws-lambda-initialization'),
};
const settings = (serverlessSdk._settings = {});

const isObject = require('type/object/is');
const ensureString = require('type/string/ensure');

const resolveSettings = (options = {}) => {
  if (!isObject(options)) options = {};
  serverlessSdk.orgId =
    process.env.SLS_ORG_ID ||
    ensureString(options.orgId, { isOptional: true, name: 'options.orgId' });

  serverlessSdk._settings.disableHttpMonitoring = Boolean(
    process.env.SLS_DISABLE_HTTP_MONITORING || options.disableHttpMonitoring
  );
  serverlessSdk._settings.disableRequestMonitoring = Boolean(
    process.env.SLS_DISABLE_REQUEST_MONITORING || options.disableRequestMonitoring
  );
  serverlessSdk._settings.disableResponseMonitoring = Boolean(
    process.env.SLS_DISABLE_RESPONSE_MONITORING || options.disableResponseMonitoring
  );
  serverlessSdk._settings.disableAwsSdkMonitoring = Boolean(
    process.env.SLS_DISABLE_AWS_SDK_MONITORING || options.disableAwsSdkMonitoring
  );
};

let isInitialized = false;
serverlessSdk._initialize = (options = {}) => {
  if (isInitialized) return module.exports;
  isInitialized = true;
  resolveSettings(options);

  if (!settings.disableHttpMonitoring) {
    // Auto generate HTTP(S) request spans
    require('./lib/instrument/http').install();
  }

  if (!settings.disableAwsSdkMonitoring) {
    // Auto generate AWS SDK request spans
    require('./lib/instrument/aws-sdk').install();
  }

  return serverlessSdk;
};

serverlessSdk.instrument = {
  awsSdkV2: require('./instrument/aws-sdk-v2'),
  awsSdkV3Client: require('./instrument/aws-sdk-v3-client'),
};
