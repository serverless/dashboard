'use strict';

const { expect } = require('chai');

describe('trace-spans/aws-lambda.test.js', () => {
  let awsLambdaTraceSpan;
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';
    awsLambdaTraceSpan = require('../../../trace-spans/aws-lambda');
  });
  it('should be TraceSpan instance', () =>
    expect(awsLambdaTraceSpan.constructor.name).to.equal('TraceSpan'));
  it('should be root span', () => expect(awsLambdaTraceSpan.parentSpan).to.be.null);
  it('should be named "aws.lambda"', () => expect(awsLambdaTraceSpan.name).to.equal('aws.lambda'));
});
