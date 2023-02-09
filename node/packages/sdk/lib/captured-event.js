'use strict';

const ensureBigInt = require('type/big-int/ensure');
const ensureString = require('type/string/ensure');
const isObject = require('type/object/is');
const ensurePlainObject = require('type/plain-object/ensure');
const d = require('d');
const lazy = require('d/lazy');
const ensureEventName = require('./get-ensure-resource-name')('INVALID_CAPTURED_EVENT_NAME');
const generateId = require('./generate-id');
const resolveEpochTimestampString = require('./resolve-epoch-timestamp-string');
const toProtobufEpochTimestamp = require('./to-protobuf-epoch-timestamp');
const toProtobufTags = require('./to-protobuf-tags');
const emitter = require('./emitter');
const Tags = require('./tags');
const TraceSpan = require('./trace-span');
const ServerlessSdkError = require('./error');
const reportError = require('./report-error');

class CapturedEvent {
  constructor(name, options = {}) {
    const defaultTimestamp = process.hrtime.bigint();
    this.name = ensureEventName(name);
    if (!isObject(options)) options = {};
    const timestamp = ensureBigInt(options.timestamp, { isOptional: true });
    if (timestamp) {
      if (timestamp > defaultTimestamp) {
        throw Object.assign(
          new Error('Cannot intialize captured event Start time cannot be set in the future'),
          { code: 'FUTURE_EVENT_TIMESTAMP' }
        );
      }
    }
    this.timestamp = timestamp || defaultTimestamp;
    const tags = ensurePlainObject(options.tags, {
      isOptional: true,
      name: 'options.tags',
    });
    if (tags) this.tags.setMany(tags);
    const customTags = ensurePlainObject(options.customTags, {
      isOptional: true,
      name: 'options.customTags',
    });
    try {
      if (customTags) this.customTags._setMany(customTags);
      this.customFingerprint = ensureString(options.customFingerprint, {
        isOptional: true,
        name: 'options.fingerprint',
        Error: ServerlessSdkError,
      });
    } catch (error) {
      reportError(error, { type: 'USER' });
    }
    if (options._origin) this._origin = options._origin;
    this.traceSpan = options._traceSpan || TraceSpan.resolveCurrentSpan();
    emitter.emit('captured-event', this);
  }
  toJSON() {
    return {
      id: this.id,
      traceId: (this.traceSpan && this.traceSpan.traceId) || null,
      traceSpanId: (this.traceSpan && this.traceSpan.id) || null,
      name: this.name,
      timestamp: resolveEpochTimestampString(this.timestamp),
      tags: Object.fromEntries(this.tags),
      customFingerprint: this.customFingerprint || undefined,
      customTags: Object.fromEntries(this.customTags),
    };
  }
  toProtobufObject() {
    return {
      id: Buffer.from(this.id),
      traceId: this.traceSpan ? Buffer.from(this.traceSpan.traceId) : undefined,
      spanId: this.traceSpan ? Buffer.from(this.traceSpan.id) : undefined,
      timestampUnixNano: toProtobufEpochTimestamp(this.timestamp),
      eventName: this.name,
      customFingerprint: this.customFingerprint || undefined,
      customTags: JSON.stringify(Object.fromEntries(this.customTags)),
      tags: toProtobufTags(this.tags),
    };
  }
}

Object.defineProperties(
  CapturedEvent.prototype,
  lazy({
    id: d(() => generateId()),
    tags: d(() => new Tags()),
    customTags: d(() => new Tags()),
  })
);

module.exports = CapturedEvent;
