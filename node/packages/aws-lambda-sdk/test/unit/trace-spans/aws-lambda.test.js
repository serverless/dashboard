'use strict';

const { expect } = require('chai');

const TraceSpan = require('../../../lib/trace-span');

const awsLambdaTraceSpan = require('../../../trace-spans/aws-lambda');

describe('trace-spans/aws-lambda.test.js', () => {
  it('should be TraceSpan instance', () => expect(awsLambdaTraceSpan).to.be.instanceOf(TraceSpan));
  it('should be root span', () => expect(awsLambdaTraceSpan.parentSpan).to.be.null);
  it('should be named "aws.lambda"', () => expect(awsLambdaTraceSpan.name).to.equal('aws.lambda'));
});
