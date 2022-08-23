'use strict';

const { expect } = require('chai');

const TraceSpan = require('../../lib/trace-span');

describe('index.test.js', () => {
  let serverlessSdk;
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';
    serverlessSdk = require('../../');
  });
  it('should expose "aws.lambda" trace span', () =>
    expect(serverlessSdk.traceSpans.awsLambda).to.be.instanceOf(TraceSpan));
  it('should expose "aws.lambda.initialization" trace span', () =>
    expect(serverlessSdk.traceSpans.awsLambdaInitialization).to.be.instanceOf(TraceSpan));
});
