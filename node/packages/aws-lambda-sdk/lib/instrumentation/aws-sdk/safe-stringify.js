'use strict';

const util = require('util');
const isObject = require('type/object/is');

// Credit: https://github.com/sindresorhus/is-stream/blob/6913e344ab2dd63041bb7c03095876ce5a7e0a8b/index.js#L1-L5
const isStream = (value) => isObject(value) && typeof value.pipe === 'function';

const replacer = (key, value) => {
  if (typeof value === 'bigint') return value.toString();
  if (isStream(value)) return '<stream>';
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
