'use strict';

const coerceToNaturalNumber = require('type/natural-number/coerce');
const TraceSpan = require('./lib/trace-span');

const serverlessSdk = module.exports;

serverlessSdk.createTraceSpan = (name, options = {}) => new TraceSpan(name, options);

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
  serverlessSdk._settings.disableRequestResponseMonitoring = Boolean(
    process.env.SLS_DISABLE_REQUEST_RESPONSE_MONITORING || options.disableRequestResponseMonitoring
  );
  serverlessSdk._settings.disableAwsSdkMonitoring = Boolean(
    process.env.SLS_DISABLE_AWS_SDK_MONITORING || options.disableAwsSdkMonitoring
  );
  serverlessSdk._settings.disableExpressMonitoring = Boolean(
    process.env.SLS_DISABLE_EXPRESS_MONITORING || options.disableExpressMonitoring
  );
  serverlessSdk._settings.traceMaxCapturedBodySizeKb =
    coerceToNaturalNumber(process.env.SLS_TRACE_MAX_CAPTURED_BODY_SIZE_KB) ||
    coerceToNaturalNumber(options.traceMaxCapturedBodySizeKb) ||
    10000;
};

let isInitialized = false;
serverlessSdk._initialize = (options = {}) => {
  if (isInitialized) return module.exports;
  isInitialized = true;
  resolveSettings(options);

  if (!settings.disableHttpMonitoring) {
    // Auto generate HTTP(S) request spans
    require('./lib/instrumentation/http').install();
  }

  if (!settings.disableAwsSdkMonitoring) {
    // Auto generate AWS SDK request spans
    require('./lib/instrumentation/aws-sdk').install();
  }

  if (!settings.disableExpressMonitoring) {
    // Auto generate AWS SDK request spans
    require('./lib/instrumentation/express').install();
  }

  return serverlessSdk;
};

serverlessSdk.instrumentation = {
  awsSdkV2: require('./instrumentation/aws-sdk-v2'),
  awsSdkV3Client: require('./instrumentation/aws-sdk-v3-client'),
  expressApp: require('./instrumentation/express-app'),
};

serverlessSdk._isDebugMode = Boolean(process.env.SLS_SDK_DEBUG);
serverlessSdk._debugLog = (...args) => {
  if (serverlessSdk._isDebugMode) process._rawDebug('⚡ SDK:', ...args);
};

serverlessSdk._isDevMode = Boolean(process.env.SLS_DEV_MODE_ORG_ID);
serverlessSdk._traceSpanEmitter = require('./lib/trace-span/emitter');
serverlessSdk.version = require('./package').version;
