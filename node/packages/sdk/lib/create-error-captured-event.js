'use strict';

const util = require('util');
const isObject = require('type/object/is');
const isError = require('type/error/is');
const CapturedEvent = require('./captured-event');
const resolveStackTraceString = require('./resolve-stack-trace-string');
const resolveNonErrorName = require('./resolve-non-error-name');

const typeMap = new Map([
  ['unhandled', 1],
  ['handledUser', 2],
  ['handledSdkUser', 3],
  ['handledSdkInternal', 4],
]);

module.exports = (error, options = {}) => {
  const timestamp = options._timestamp || process.hrtime.bigint();
  if (!isObject(options)) options = {};

  const capturedEvent = new CapturedEvent('telemetry.error.generated.v1', {
    timestamp,
    customTags: options.tags,
    customFingerprint: options.fingerprint,
    _origin: options._origin,
  });

  const type = options._type || 'handledUser';
  const tags = { type: typeMap.get(type) };
  if (isError(error)) {
    tags.name = error.name;
    tags.message = error.message;
  } else {
    tags.name = options._name || resolveNonErrorName(error);
    tags.message = typeof error === 'string' ? error : util.inspect(error);
  }
  tags.stacktrace = options._stack || resolveStackTraceString(error);
  capturedEvent.tags.setMany(tags, { prefix: 'error' });

  if (
    options._origin === 'nodeConsole' ||
    type !== 'handledUser' ||
    serverlessSdk._settings.disableCapturedEventsStdout
  ) {
    return capturedEvent;
  }

  const errorLogData = {
    source: 'serverlessSdk',
    type: 'ERROR_TYPE_CAUGHT_USER',
    name: tags.name,
    message: tags.message,
    stack: tags.stacktrace,
  };
  if (options.fingerprint) errorLogData.fingerprint = options.fingerprint;
  console.error(JSON.stringify(errorLogData));

  return capturedEvent;
};

const serverlessSdk = require('../');
