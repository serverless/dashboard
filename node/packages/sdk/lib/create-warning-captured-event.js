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

  return new CapturedEvent('telemetry.warning.generated.v1', {
    timestamp,
    customTags: options.tags,
    customFingerprint: options.fingerprint,
    tags: {
      'warning.message': message,
      'warning.type': typeMap.get(options._type || 'user'),
      'warning.stacktrace': resolveStackTraceString(),
    },
    _origin: options._origin,
  });
};
