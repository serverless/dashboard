'use strict';

const util = require('util');
const isObject = require('type/object/is');
const isError = require('type/error/is');
const CapturedEvent = require('./captured-event');

const resolveNonErrorName = (value) => {
  if (isObject(value)) return 'object';
  if (value === null) return 'null';
  return typeof value;
};

module.exports = (error, options = {}) => {
  const timestamp = process.hrtime.bigint();
  if (!isObject(options)) options = {};

  const capturedEvent = new CapturedEvent('telemetry.error.generated.v1', {
    timestamp,
    customTags: options.tags,
    customFingerprint: options.fingerprint,
    _origin: options._origin,
  });

  const tags = { type: 2 };
  if (isError(error)) {
    tags.name = error.name;
    tags.message = error.message;
    tags.stacktrace = error.stack;
  } else {
    tags.name = resolveNonErrorName(error);
    tags.message = typeof error === 'string' ? error : util.inspect(error);
  }
  capturedEvent.tags.setMany(tags, { prefix: 'error' });

  return capturedEvent;
};
