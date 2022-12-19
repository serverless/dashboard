'use strict';

const ensureString = require('type/string/ensure');
const ensureFinite = require('type/finite/ensure');
const isObject = require('type/object/is');
const ensurePlainObject = require('type/plain-object/ensure');
const isDate = require('type/date/is');
const resolveException = require('type/lib/resolve-exception');
const capitalize = require('ext/string_/capitalize');

const isValidTagName = RegExp.prototype.test.bind(
  /^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$/
);

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

module.exports = class Tags extends Map {
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
  toJSON() {
    return Object.fromEntries(this);
  }
};
