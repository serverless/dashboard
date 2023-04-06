'use strict';

const isObject = require('type/object/is');
const ensureString = require('type/string/ensure');
const CapturedEvent = require('./captured-event');
const resolveStackTraceString = require('./resolve-stack-trace-string');

const typeMap = new Map([
  ['user', 1],
  ['sdkUser', 2],
  ['sdkInternal', 3],
]);

module.exports = (message, options = {}) => {
  const timestamp = process.hrtime.bigint();
  message = ensureString(message, { name: 'message' });
  if (!isObject(options)) options = {};

  const type = options._type || 'user';
  const stackTrace = resolveStackTraceString();
  const capturedEvent = new CapturedEvent('telemetry.warning.generated.v1', {
    timestamp,
    customTags: options.tags,
    customFingerprint: options.fingerprint,
    tags: {
      'warning.message': message,
      'warning.type': typeMap.get(type),
      'warning.stacktrace': stackTrace,
    },
    _origin: options._origin,
  });

  if (
    options._origin === 'nodeConsole' ||
    type !== 'user' ||
    serverlessSdk._settings.disableCapturedEventsStdout
  ) {
    return capturedEvent;
  }

  const warnLogData = {
    source: 'serverlessSdk',
    type: 'WARNING_TYPE_USER',
    message,
    stack: stackTrace,
  };
  if (options.fingerprint) warnLogData.fingerprint = options.fingerprint;
  console.warn(JSON.stringify(warnLogData));

  return capturedEvent;
};

const serverlessSdk = require('../');
