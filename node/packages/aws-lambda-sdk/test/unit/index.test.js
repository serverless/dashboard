'use strict';

const { expect } = require('chai');

const TraceSpan = require('../../lib/trace-span');

const serverlessSdk = require('../../');

describe('index.test.js', () => {
  it('should expose "aws.lambda" trace span', () =>
    expect(serverlessSdk.traceSpans.awsLambda).to.be.instanceOf(TraceSpan));
  it('should expose "aws.lambda.initialization" trace span', () =>
    expect(serverlessSdk.traceSpans.awsLambdaInitialization).to.be.instanceOf(TraceSpan));
});
