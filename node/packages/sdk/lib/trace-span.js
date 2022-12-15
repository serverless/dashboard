'use strict';

const ensureString = require('type/string/ensure');
const ensureFinite = require('type/finite/ensure');
const ensureBigInt = require('type/big-int/ensure');
const ensureIterable = require('type/iterable/ensure');
const isDate = require('type/date/is');
const isObject = require('type/object/is');
const ensurePlainObject = require('type/plain-object/ensure');
const ensurePlainFunction = require('type/plain-function/ensure');
const resolveException = require('type/lib/resolve-exception');
const capitalize = require('ext/string_/capitalize');
const d = require('d');
const lazy = require('d/lazy');
const { AsyncLocalStorage } = require('async_hooks');
const Long = require('long');
const crypto = require('crypto');
const emitter = require('./emitter');

const isValidSpanName = RegExp.prototype.test.bind(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/);
const isValidTagName = RegExp.prototype.test.bind(
  /^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$/
);

const generateId = () => crypto.randomBytes(16).toString('hex');

const resolveEpochTimestampString = (() => {
  const diff = BigInt(Date.now()) * BigInt(1000000) - process.hrtime.bigint();
  return (uptimeTimestamp) => String(uptimeTimestamp + diff);
})();

const toLong = (value) => {
  const data = Long.fromString(String(value));
  return new Long(data.low, data.high, true);
};

const toProtobufEpochTimestamp = (uptimeTimestamp) =>
  toLong(resolveEpochTimestampString(uptimeTimestamp));

const resolvePorotbufValue = (key, value) => {
  switch (key) {
    // enum cases
    case 'aws.lambda.outcome':
      switch (value) {
        case 'success':
          return 1;
        case 'error:handled':
          return 5;
        default:
          // Will error in tests
          return null;
      }
    default:
      if (Array.isArray(value)) {
        if (typeof value[0] === 'number') return value.map(toLong);
        return value;
      }
      return typeof value === 'number' ? toLong(value) : value;
  }
};

const snakeToCamelCase = (string) =>
  string.replace(/_(.)/g, (ignore, letter) => letter.toUpperCase());

const ensureSpanName = (() => {
  const errorCode = 'INVALID_TRACE_SPAN_NAME';
  return (inputValue) => {
    const value = ensureString(inputValue, {
      errorCode,
      errorMessage: 'Invalid trace span name: Expected string, received "%v"',
    });
    if (isValidSpanName(value)) return value;
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage:
        'Invalid trace span name: Name should contain dot separated tokens that follow ' +
        '"[a-z][a-z0-9]*" pattern. Received "%v"',
    });
  };
})();

const ensureTagName = (() => {
  const errorCode = 'INVALID_TRACE_SPAN_TAG_NAME';
  return (inputValue, propertyName = 'name') => {
    const value = ensureString(inputValue, {
      errorCode,
      errorMessage: `Invalid trace span tag ${propertyName}: Expected string, received "%v"`,
    });
    if (isValidTagName(value)) return value;
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage:
        `Invalid trace span tag ${propertyName}: ${capitalize.call(
          propertyName
        )} should contain dot separated tokens that follow ` +
        '"[a-z][a-z0-9_]*" pattern. Received "%v"',
    });
  };
})();

const ensureTagValue = (() => {
  const errorCode = 'INVALID_TRACE_SPAN_TAG_VALUE';
  return (inputValue, tagName) => {
    if (typeof inputValue === 'string') return inputValue;
    if (typeof inputValue === 'number') {
      return ensureFinite(inputValue, {
        errorCode,
        errorMessage:
          `Invalid trace span tag value for "${tagName}": ` +
          'Number must be finite, received "%v"',
      });
    }
    if (typeof inputValue === 'boolean') return inputValue;
    if (isDate(inputValue)) return inputValue.toISOString();
    if (Array.isArray(inputValue)) {
      let type = null;
      return inputValue.map((item) => {
        if (typeof item === 'string') {
          if (type == null) type = 'string';
          if (type === 'string') return item;
        } else if (typeof item === 'number') {
          if (type == null) type = 'number';
          if (type === 'number') {
            return ensureFinite(item, {
              errorCode,
              errorMessage:
                `Invalid trace span tag value for "${tagName}": ` +
                'Number must be finite, received "%v"',
            });
          }
        } else if (isDate(inputValue)) {
          if (type == null) type = 'date';
          if (type === 'date') return inputValue.toISOString();
        } else {
          return resolveException(inputValue, null, {
            errorCode,
            errorMessage:
              `Invalid trace span tag value for "${tagName}": ` +
              'Unrecognized value type in array:"%v"',
          });
        }
        return resolveException(inputValue, null, {
          errorCode,
          errorMessage:
            `Invalid trace span tag value for "${tagName}": ` +
            'Array cannot have mixed type values:"%v"',
        });
      });
    }
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage:
        `Invalid trace span tag value for "${tagName}": ` +
        'Value must be either boolean, number, string, date or array of same values. Received "%v"',
    });
  };
})();

class StringifiableSet extends Set {
  toJSON() {
    return Array.from(this);
  }
}

class TraceSpanTags extends Map {
  set(inputName, value) {
    const name = ensureTagName(inputName);
    value = ensureTagValue(value, name);
    if (this.has(name)) {
      const currentValue = this.get(name);
      if (Array.isArray(value)) {
        if (Array.isArray(currentValue)) {
          if (
            value.length === currentValue.length &&
            value.every((item, index) => currentValue[index] === item)
          ) {
            return this;
          }
        }
      } else if (value === currentValue) {
        return this;
      }
      throw Object.assign(new Error(`Cannot set tag: Tag "${inputName}" is already set`), {
        code: 'DUPLICATE_TRACE_SPAN_TAG_NAME',
      });
    }
    return super.set(name, value);
  }
  setMany(tags, options = {}) {
    ensurePlainObject(tags, { name: 'tags' });
    if (!isObject(options)) options = {};
    const prefix = ensureString(options.prefix, { isOptional: true, name: 'options.prefix' });
    if (prefix) ensureTagName(prefix, 'prefix');
    for (const [name, value] of Object.entries(tags)) {
      if (value == null) continue;
      this.set(`${prefix ? `${prefix}.` : ''}${name}`, value);
    }
    return this;
  }
}

const asyncLocalStorage = new AsyncLocalStorage();

let rootSpan;

class TraceSpan {
  constructor(name, options = {}) {
    const defaultStartTime = process.hrtime.bigint();
    const startTime = ensureBigInt(options.startTime, { isOptional: true });
    if (startTime) {
      if (startTime > process.hrtime.bigint()) {
        throw Object.assign(
          new Error('Cannot intialize span: Start time cannot be set in the future'),
          { code: 'FUTURE_SPAN_START_TIME' }
        );
      }
      if (this.parentSpan && startTime < this.parentSpan.startTime) {
        throw Object.assign(
          new Error(
            'Cannot intialize span: Start time cannot be older than start time of parent span'
          ),
          { code: 'PAST_PARENT_SPAN_START_TIME' }
        );
      }
    }
    this.startTime = startTime || defaultStartTime;
    this.name = ensureSpanName(name);

    const immediateDescendants = ensureIterable(options.immediateDescendants, {
      isOptional: true,
      ensureItem: ensureSpanName,
    });
    this._onCloseByRoot = ensurePlainFunction(options.onCloseByRoot, {
      isOptional: true,
      name: 'options.onCloseByRoot',
    });
    const tags = ensurePlainObject(options.tags, {
      isOptional: true,
      name: 'options.tags',
    });
    if (tags) this.tags.setMany(tags);
    if (options.input != null) this.input = options.input;
    if (options.output != null) this.output = options.output;
    if (!rootSpan) {
      rootSpan = this;
      this.parentSpan = null;
    } else {
      if (rootSpan.endTime) {
        throw Object.assign(new Error('Cannot intialize span: Trace is closed'), {
          code: 'UNREACHABLE_TRACE',
        });
      }
      this.parentSpan = asyncLocalStorage.getStore() || rootSpan || null;
      while (this.parentSpan.endTime) this.parentSpan = this.parentSpan.parentSpan || rootSpan;
    }

    asyncLocalStorage.enterWith(this);

    if (this.parentSpan) this.parentSpan.subSpans.add(this);
    emitter.emit('trace-span-open', this);
    if (immediateDescendants && immediateDescendants.length) {
      // eslint-disable-next-line no-new
      new TraceSpan(immediateDescendants.shift(), {
        startTime: this.startTime,
        immediateDescendants,
      });
    }
  }
  closeContext() {
    if (asyncLocalStorage.getStore() !== this) return;
    if (this === rootSpan) {
      asyncLocalStorage.enterWith(this);
      return;
    }
    const openParentSpan = (function self(span) {
      if (!span.endTime) return span;
      return span.parentSpan ? self(span.parentSpan) : rootSpan;
    })(this.parentSpan);
    asyncLocalStorage.enterWith(openParentSpan);
  }
  close(options = {}) {
    const defaultEndTime = process.hrtime.bigint();
    if (this.endTime) {
      throw Object.assign(new Error('Cannot close span: Span already closed'), {
        code: 'CLOSURE_ON_CLOSED_SPAN',
      });
    }
    if (!isObject(options)) options = {};
    const targetEndTime = ensureBigInt(options.endTime, { isOptional: true });
    if (targetEndTime) {
      if (targetEndTime < this.startTime) {
        throw Object.assign(
          new Error('Cannot close span: End time cannot be earlier than start time'),
          { code: 'PAST_SPAN_END_TIME' }
        );
      }
      if (targetEndTime > defaultEndTime) {
        throw Object.assign(new Error('Cannot close span: End time cannot be set in the future'), {
          code: 'FUTURE_SPAN_END_TIME',
        });
      }
    }
    this.endTime = targetEndTime || defaultEndTime;
    if (this === rootSpan) {
      const leftoverSpans = [];
      for (const subSpan of this.spans) {
        if (subSpan.endTime) continue;
        if (subSpan._onCloseByRoot) subSpan._onCloseByRoot();
        if (subSpan.endTime) continue;
        leftoverSpans.push(subSpan.close({ endTime: this.endTime }));
      }
      if (leftoverSpans.length) {
        process.stderr.write(
          "Serverless SDK Warning: Following trace spans didn't end before end of " +
            `lambda invocation: ${leftoverSpans.map(({ name }) => name).join(', ')}\n`
        );
      }
      asyncLocalStorage.enterWith(this);
    } else {
      this.closeContext();
    }
    emitter.emit('trace-span-close', this);
    return this;
  }
  destroy() {
    this.closeContext();
    if (this.parentSpan) this.parentSpan.subSpans.delete(this);
    this.parentSpan = null;
  }
  toJSON() {
    return {
      traceId: this.traceId,
      id: this.id,
      name: this.name,
      startTime: resolveEpochTimestampString(this.startTime),
      endTime: this.endTime && resolveEpochTimestampString(this.endTime),
      input: this.input || undefined,
      output: this.output || undefined,
      tags: Object.fromEntries(this.tags),
    };
  }
  toProtobufObject() {
    const tags = {};
    for (const [key, value] of this.tags) {
      let context = tags;
      const keyTokens = key.split('.').map((token) => snakeToCamelCase(token));
      const lastToken = keyTokens.pop();
      for (const token of keyTokens) {
        if (!context[token]) context[token] = {};
        context = context[token];
      }
      context[lastToken] = resolvePorotbufValue(key, value);
    }
    return {
      id: Buffer.from(this.id),
      traceId: Buffer.from(this.traceId),
      parentSpanId: this.parentSpan ? Buffer.from(this.parentSpan.id) : undefined,
      name: this.name,
      startTimeUnixNano: toProtobufEpochTimestamp(this.startTime),
      endTimeUnixNano: this.endTime ? toProtobufEpochTimestamp(this.endTime) : undefined,
      input: this.input || undefined,
      output: this.output || undefined,
      tags,
    };
  }
  get spans() {
    return new StringifiableSet([
      this,
      ...Array.from(this.subSpans, (subSpan) => Array.from(subSpan.spans)).flat(Infinity),
    ]);
  }
  get input() {
    return this._input || null;
  }
  set input(body) {
    if (body == null) delete this._input;
    else this._input = ensureString(body);
  }
  get output() {
    return this._output || null;
  }
  set output(body) {
    if (body == null) delete this._output;
    else this._output = ensureString(body);
  }
}

TraceSpan._toProtobufEpochTimestamp = toProtobufEpochTimestamp;

Object.defineProperties(
  TraceSpan.prototype,
  lazy({
    traceId: d(function () {
      return this.parentSpan ? this.parentSpan.traceId : generateId();
    }),
    id: d(() => generateId()),
    subSpans: d(() => new Set()),
    tags: d(() => new TraceSpanTags()),
  })
);

module.exports = TraceSpan;
