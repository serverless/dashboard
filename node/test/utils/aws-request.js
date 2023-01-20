'use strict';

const awsRequest = require('@serverless/test/aws-request');

const awsClientParams = { region: process.env.AWS_REGION };

module.exports = (client, method, args) =>
  awsRequest({ client, params: awsClientParams }, method, args);
