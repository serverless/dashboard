'use strict';

const path = require('path');
const Long = require('long');

const projectDir = path.resolve(__dirname, '../..');

const { expect } = require('chai');
const { normalizeObject } = require('../utils');

const {
  TracePayload,
  AwsLambdaTags_Outcome: AwsLambdaTagsOutcome,
} = require(`${projectDir}/dist/index.cjs`);

const longValue = new Long('12313213', '12313221', true);

const testTracePayload = {
  slsTags: {
    orgId: 'abc123',
    sdk: {
      name: 'aws-lambda-sdk',
      version: '0.0.1',
    },
    platform: 'lambda',
    region: 'us-east-1',
    service: 'my-test-function',
  },
  spans: [
    {
      id: Buffer.from('Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk'),
      traceId: Buffer.from('YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1'),
      name: 'test',
      startTimeUnixNano: longValue,
      endTimeUnixNano: longValue,
      tags: {
        aws: {
          lambda: {
            arch: 'arm64',
            isColdstart: true,
            eventType: 'aws.apigatewayv2',
            eventSource: 'aws.apigatewayv2',
            logGroup: 'abc12',
            logStreamName: 'abc123',
            maxMemory: 1024,
            name: 'my-test-function',
            requestId: 'bdb40738-ff36-48c0-9842-9befd0141cd6',
            version: '$LATEST',
            outcome: AwsLambdaTagsOutcome.OUTCOME_SUCCESS,
            apiGateway: {
              accountId: '012345678901',
              apiId: 'abc123',
              apiStage: 'dev',
              request: {
                id: '2e4d98fe-1603-477f-b976-1013e84ea4a6',
                timeEpoch: longValue,
                pathParameterNames: [],
              },
            },
            http: {
              protocol: 'HTTP/1.1',
              host: 'abc.example.com',
              method: 'GET',
              path: '/test',
              queryParameterNames: [],
              requestHeaderNames: [],
            },
          },
        },
      },
    },
  ],
  events: [],
};

describe('span-schema', () => {
  it('should parse AWS Lambda Root Span', () => {
    expect(testTracePayload).to.deep.equal(
      normalizeObject(TracePayload.decode(TracePayload.encode(testTracePayload).finish()))
    );
  });
});
