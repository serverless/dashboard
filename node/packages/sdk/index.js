'use strict';

const uniGlobal = require('uni-global')('serverless/sdk/202212');

if (uniGlobal.serverlessSdk) {
  module.exports = uniGlobal.serverlessSdk;
  return;
}

uniGlobal.serverlessSdk = module.exports;

const coerceToNaturalNumber = require('type/natural-number/coerce');
const ensureString = require('type/string/ensure');
const d = require('d');
const lazy = require('d/lazy');
const Tags = require('./lib/tags');
const TraceSpan = require('./lib/trace-span');
const createErrorCapturedEvent = require('./lib/create-error-captured-event');
const createWarningCapturedEvent = require('./lib/create-warning-captured-event');
const reportError = require('./lib/report-error');
const reportWarning = require('./lib/report-warning');
const pkgJson = require('./package');

const serverlessSdk = module.exports;

// Public
serverlessSdk.name = pkgJson.name;
serverlessSdk.version = pkgJson.version;
serverlessSdk.traceSpans = {
  get root() {
    return TraceSpan.rootSpan;
  },
};
serverlessSdk.instrumentation = {};
Object.defineProperties(
  serverlessSdk.instrumentation,
  lazy({
    expressApp: d('cew', () => require('./instrumentation/express-app'), { flat: true }),
  })
);
serverlessSdk.captureError = (error, options = {}) => {
  try {
    createErrorCapturedEvent(error, options);
  } catch (internalError) {
    reportError(internalError);
  }
};
serverlessSdk.captureWarning = (message, options = {}) => {
  try {
    createWarningCapturedEvent(message, options);
  } catch (internalError) {
    reportError(internalError);
  }
};
serverlessSdk.setTag = (name, value) => {
  try {
    serverlessSdk._customTags._set(name, value);
  } catch (error) {
    reportError(error, { type: 'USER' });
  }
};

// Private
const settings = (serverlessSdk._settings = {});

let isInitialized = false;
serverlessSdk._initialize = (options = {}) => {
  if (isInitialized) return module.exports;
  isInitialized = true;

  if (!options) options = {};

  serverlessSdk.orgId =
    process.env.SLS_ORG_ID ||
    ensureString(options.orgId, { isOptional: true, name: 'options.orgId' });

  serverlessSdk._settings.disableHttpMonitoring = Boolean(
    process.env.SLS_DISABLE_HTTP_MONITORING || options.disableHttpMonitoring
  );
  serverlessSdk._settings.disableRequestResponseMonitoring = Boolean(
    process.env.SLS_DISABLE_REQUEST_RESPONSE_MONITORING || options.disableRequestResponseMonitoring
  );
  serverlessSdk._settings.disableExpressMonitoring = Boolean(
    process.env.SLS_DISABLE_EXPRESS_MONITORING || options.disableExpressMonitoring
  );
  serverlessSdk._settings.disableNodeConsoleMonitoring = Boolean(
    process.env.SLS_DISABLE_NODE_CONSOLE_MONITORING || options.disableNodeConsoleMonitoring
  );
  serverlessSdk._settings.traceMaxCapturedBodySizeKb =
    coerceToNaturalNumber(process.env.SLS_TRACE_MAX_CAPTURED_BODY_SIZE_KB) ||
    coerceToNaturalNumber(options.traceMaxCapturedBodySizeKb) ||
    10000;

  if (!settings.disableHttpMonitoring) {
    // Auto generate HTTP(S) request spans
    require('./lib/instrumentation/http').install();
  }

  if (!settings.disableExpressMonitoring) {
    // Auto generate AWS SDK request spans
    require('./lib/instrumentation/express').install();
  }

  if (!settings.disableNodeConsoleMonitoring) {
    // Auto capture `console.error` and `console.warning` invocations
    require('./lib/instrumentation/node-console').install();
  }

  if (serverlessSdk._initializeExtension) serverlessSdk._initializeExtension(options);

  return serverlessSdk;
};

serverlessSdk._createTraceSpan = (name, options = {}) => new TraceSpan(name, options);
serverlessSdk._reportError = reportError;
serverlessSdk._reportWarning = reportWarning;
serverlessSdk._isDebugMode = Boolean(process.env.SLS_SDK_DEBUG);
serverlessSdk._debugLog = (...args) => {
  if (serverlessSdk._isDebugMode) process._rawDebug('⚡ SDK:', ...args);
};

serverlessSdk._eventEmitter = require('./lib/emitter');

Object.defineProperties(
  serverlessSdk,
  lazy({ _customTags: d('cew', () => new Tags(), { flat: true }) })
);
