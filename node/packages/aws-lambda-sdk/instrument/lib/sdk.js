'use strict';

try {
  require.resolve('@serverless/aws-lambda-sdk');
} catch {
  module.exports = require('../../');
  return;
}

// eslint-disable-next-line import/no-unresolved
module.exports = require('@serverless/aws-lambda-sdk');
