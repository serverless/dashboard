'use strict';

// eslint-disable-next-line import/no-unresolved
require('aws-sdk');

module.exports.handler = (event, context, callback) => {
  callback(null, { statusCode: 200, body: JSON.stringify({ result: 'ok', filename: __filename }) });
};
