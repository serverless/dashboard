'use strict';

const util = require('util');
const isObject = require('type/object/is');
const isError = require('type/error/is');
const CapturedEvent = require('./captured-event');
const resolveStackTraceString = require('./resolve-stack-trace-string');
const resolveNonErrorName = require('./resolve-non-error-name');

module.exports = (error, options = {}) => {
  const timestamp = options._timestamp || process.hrtime.bigint();
  if (!isObject(options)) options = {};

  const capturedEvent = new CapturedEvent('telemetry.error.generated.v1', {
    timestamp,
    customTags: options.tags,
    customFingerprint: options.fingerprint,
    _origin: options._origin,
  });

  const tags = { type: options._type === 'unhandled' ? 1 : 2 };
  if (isError(error)) {
    tags.name = error.name;
    tags.message = error.message;
  } else {
    tags.name = resolveNonErrorName(error);
    tags.message = typeof error === 'string' ? error : util.inspect(error);
  }
  tags.stacktrace = resolveStackTraceString(error);
  capturedEvent.tags.setMany(tags, { prefix: 'error' });

  return capturedEvent;
};
