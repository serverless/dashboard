'use strict';

// eslint-disable-next-line import/no-unresolved
const serverlessSdk = require('@serverless/aws-lambda-sdk');
const AWS = require('aws-sdk');

serverlessSdk.instrumentation.awsSdkV2.install(AWS);

const sts = new AWS.STS();

module.exports.handler = async () => {
  // STS (confirm on tracing of any AWS service)
  await sts.getCallerIdentity().promise();

  return 'ok';
};
