'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('trace-spans/aws-lambda.test.js', () => {
  let awsLambdaTraceSpan;
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';
    awsLambdaTraceSpan = requireUncached(() => require('../../../trace-spans/aws-lambda'));
  });
  it('should be TraceSpan instance', () =>
    expect(awsLambdaTraceSpan.constructor.name).to.equal('TraceSpan'));
  it('should be root span', () => expect(awsLambdaTraceSpan.parentSpan).to.be.null);
  it('should be named "aws.lambda"', () => expect(awsLambdaTraceSpan.name).to.equal('aws.lambda'));
});
