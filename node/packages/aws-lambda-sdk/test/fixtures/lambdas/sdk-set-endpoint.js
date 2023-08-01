'use strict';

const sdk = require('@serverless/sdk');

module.exports.handler = (event, context, callback) => {
  sdk.setEndpoint('/test/set/endpoint');
  callback(null, {
    statusCode: 200,
    body: JSON.stringify('ok'),
  });
};
