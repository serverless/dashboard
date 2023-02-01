'use strict';

const util = require('util');
const isError = require('type/error/is');
const resolveNonErrorName = require('./resolve-non-error-name');
const resolveStackTraceString = require('./resolve-stack-trace-string');

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

  const errorData = { source: 'serverlessSdk', type };
  if (type === 'INTERNAL') {
    errorData.description =
      'Internal Serverless SDK Error. ' +
      'Please report at https://github.com/serverless/console/issue';
  }
  errorData.name = name;
  errorData.message = message;
  if (error.code) errorData.code = error.code;
  if (error.stack) errorData.stakTrace = resolveStackTraceString(error);
  console.error(errorData);
};
