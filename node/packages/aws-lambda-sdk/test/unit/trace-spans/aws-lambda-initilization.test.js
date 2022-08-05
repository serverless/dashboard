'use strict';

const { expect } = require('chai');

const TraceSpan = require('../../../lib/trace-span');

const awsLambdaTraceSpan = require('../../../trace-spans/aws-lambda');
const awsLambdaInitializationTraceSpan = require('../../../trace-spans/aws-lambda-initialization');

describe('trace-spans/aws-lambda-initialization.test.js', () => {
  it('should be TraceSpan instance', () =>
    expect(awsLambdaInitializationTraceSpan).to.be.instanceOf(TraceSpan));
  it('should be sub span of "aws.lambda"', () =>
    expect(awsLambdaInitializationTraceSpan.parentSpan).to.equal(awsLambdaTraceSpan));
  it('should be named "aws.lambda.initialization"', () =>
    expect(awsLambdaInitializationTraceSpan.name).to.equal('aws.lambda.initialization'));
});
