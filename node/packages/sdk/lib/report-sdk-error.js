'use strict';

const util = require('util');
const isError = require('type/error/is');
const resolveNonErrorName = require('./resolve-non-error-name');

module.exports = (error, options = {}) => {
  if (process.env.SLS_CRASH_ON_SDK_ERROR) throw error;
  let name;
  let message;
  if (isError(error)) {
    name = error.name;
    message = error.message;
  } else {
    name = resolveNonErrorName(error);
    message = typeof error === 'string' ? error : util.inspect(error);
  }
  const type = options.type || 'INTERNAL';
  console.error({
    source: 'serverlessSdk',
    type,
    description:
      type === 'INTERNAL'
        ? 'Internal Serverless SDK Error. ' +
          'Please report at https://github.com/serverless/console/issue'
        : undefined,
    name,
    message,
    code: error && error.code,
    stackTrace: error && error.stack,
  });
};
