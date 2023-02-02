'use strict';

const ensureString = require('type/string/ensure');
const ensureFinite = require('type/finite/ensure');
const isObject = require('type/object/is');
const ensurePlainObject = require('type/plain-object/ensure');
const isDate = require('type/date/is');
const resolveException = require('type/lib/resolve-exception');
const capitalize = require('ext/string_/capitalize');
const ServerlessSdkError = require('./error');
const reportError = require('./report-error');

const isValidTagName = RegExp.prototype.test.bind(/^[a-zA-Z0-9_.-]+$/);

const ensureTagName = (() => {
  const errorCode = 'INVALID_TRACE_SPAN_TAG_NAME';
  return (inputValue, propertyName = 'name') => {
    const value = ensureString(inputValue, {
      errorCode,
      errorMessage: `Invalid trace span tag ${propertyName}: Expected string, received "%v"`,
      Error: ServerlessSdkError,
    });
    if (isValidTagName(value)) return value;
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage: `Invalid trace span tag ${propertyName}: ${capitalize.call(
        propertyName
      )}. Only alphanumeric, '-', '_' and '.' characters are allowed. Received "%v"`,
      Error: ServerlessSdkError,
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
        Error: ServerlessSdkError,
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
              Error: ServerlessSdkError,
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
            Error: ServerlessSdkError,
          });
        }
        return resolveException(inputValue, null, {
          errorCode,
          errorMessage:
            `Invalid trace span tag value for "${tagName}": ` +
            'Array cannot have mixed type values:"%v"',
          Error: ServerlessSdkError,
        });
      });
    }
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage:
        `Invalid trace span tag value for "${tagName}": ` +
        'Value must be either boolean, number, string, date or array of same values. Received "%v"',
      Error: ServerlessSdkError,
    });
  };
})();

module.exports = class Tags extends Map {
  _set(inputName, value) {
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
      throw Object.assign(
        new ServerlessSdkError(`Cannot set tag: Tag "${inputName}" is already set`),
        {
          code: 'DUPLICATE_TRACE_SPAN_TAG_NAME',
        }
      );
    }
    return super.set(name, value);
  }
  set(inputName, value) {
    try {
      this._set(inputName, value);
    } catch (error) {
      reportError(error);
    }
    return this;
  }
  _setMany(tags, options = {}) {
    ensurePlainObject(tags, { name: 'tags', Error: ServerlessSdkError });
    if (!isObject(options)) options = {};
    const prefix = ensureString(options.prefix, {
      isOptional: true,
      name: 'options.prefix',
      Error: ServerlessSdkError,
    });
    if (prefix) ensureTagName(prefix, 'prefix');
    const errors = [];
    for (const [name, value] of Object.entries(tags)) {
      if (value == null) continue;
      try {
        this._set(`${prefix ? `${prefix}.` : ''}${name}`, value);
      } catch (error) {
        errors.push(error);
      }
    }
    if (!errors.length) return this;
    if (errors.length === 1) throw errors[0];
    throw new ServerlessSdkError(
      `Cannot set Tags:\n\t- ${errors.map(({ message }) => message).join('\n\t- ')}`
    );
  }
  setMany(tags, options) {
    try {
      this._setMany(tags, options);
    } catch (error) {
      reportError(error);
    }
    return this;
  }
  toJSON() {
    return Object.fromEntries(this);
  }
};
