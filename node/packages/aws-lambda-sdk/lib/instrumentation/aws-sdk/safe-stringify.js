'use strict';

const util = require('util');

const replacer = (key, value) => {
  return typeof value === 'bigint' ? value.toString() : value;
};

module.exports = (value) => {
  try {
    return JSON.stringify(value, replacer);
  } catch (error) {
    console.warn({
      source: 'serverlessSdk',
      message:
        'Detected not serializable value in AWS SDK request:\n' +
        `\tvalue: ${util.inspect(value)}\n` +
        `\terror:${error.message}`,
      code: 'AWS_SDK_DOUBLE_RESOLUTION',
    });
    return null;
  }
};
