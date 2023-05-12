'use strict';

const util = require('util');

const replacer = (key, value) => {
  if (typeof value === 'bigint') return value.toString();
  return value;
};

module.exports = (value) => {
  try {
    return JSON.stringify(value, replacer);
  } catch (error) {
    serverlessSdk._reportWarning(
      'Detected not serializable value in AWS SDK request:\n' +
        `\tvalue: ${util.inspect(value)}\n` +
        `\terror:${error.message}`,
      'AWS_SDK_NON_SERIALIZABLE_VALUE'
    );
    return null;
  }
};

const serverlessSdk = require('../../../');
