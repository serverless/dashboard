'use strict';

const { expect } = require('chai');

describe('trace-spans/aws-lambda-initialization.test.js', () => {
  let awsLambdaTraceSpan;
  let awsLambdaInitializationTraceSpan;
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test';
    awsLambdaTraceSpan = require('../../../trace-spans/aws-lambda');
    awsLambdaInitializationTraceSpan = require('../../../trace-spans/aws-lambda-initialization');
  });
  it('should be TraceSpan instance', () =>
    expect(awsLambdaInitializationTraceSpan.constructor.name).to.equal('TraceSpan'));
  it('should be sub span of "aws.lambda"', () =>
    expect(awsLambdaInitializationTraceSpan.parentSpan).to.equal(awsLambdaTraceSpan));
  it('should be named "aws.lambda.initialization"', () =>
    expect(awsLambdaInitializationTraceSpan.name).to.equal('aws.lambda.initialization'));
});
