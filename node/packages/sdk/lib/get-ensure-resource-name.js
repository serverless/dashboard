'use strict';

const ensureString = require('type/string/ensure');
const resolveException = require('type/lib/resolve-exception');

const isValidName = RegExp.prototype.test.bind(
  /^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$/
);

module.exports = (errorCode) => {
  return (inputValue) => {
    const value = ensureString(inputValue, {
      errorCode,
      errorMessage: 'Invalid captured event name: Expected string, received "%v"',
    });
    if (isValidName(value)) return value;
    return resolveException(inputValue, null, {
      errorCode,
      errorMessage:
        'Invalid captured event name: Name should contain dot separated tokens that follow ' +
        '"[a-z][a-z0-9]*" pattern. Received "%v"',
    });
  };
};
