'use strict';

const MAX_VALUE_LENGTH = require('./max-tag-value-length');

module.exports = (string) => {
  const stringBuffer = Buffer.from(string);
  if (stringBuffer.length <= MAX_VALUE_LENGTH) return string;
  return stringBuffer.slice(0, MAX_VALUE_LENGTH).toString();
};
