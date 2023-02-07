'use strict';

// eslint-disable-next-line import/no-unresolved
const serverlessSdk = require('@serverless/aws-lambda-sdk');
const { STS } = require('@aws-sdk/client-sts');

const sts = new STS();
serverlessSdk.instrumentation.awsSdkV3Client.install(sts);

module.exports.handler = async () => {
  // STS (confirm on tracing of any AWS service)
  await sts.getCallerIdentity();

  return 'ok';
};
