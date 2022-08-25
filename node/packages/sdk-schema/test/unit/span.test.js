'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

const { expect } = require('chai');

const {
  Span,
  AwsLambdaTags_Outcome: AwsLambdaTagsOutcome,
} = require(`${projectDir}/dist/index.cjs`);

const expectedLambdaRootSpan = {
  id: 'Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk',
  traceId: 'YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1',
  name: 'test',
  startTimeUnixNano: '1659551935837000000',
  endTimeUnixNano: '1659551935837000000',
  tags: {
    sls: {
      orgId: 'abc123',
      platform: 'lambda',
      service: 'my-test-function',
      region: 'us-east-1',
      sdk: {
        name: 'aws-lambda-sdk',
        version: '0.0.1',
      },
    },
    awsLambda: {
      arch: 'arm64',
      isColdstart: true,
      eventType: 'aws.apigatewayv2',
      eventSource: 'aws.apigatewayv2',
      logGroup: 'abc12',
      logStreamName: 'abc123',
      maxMemory: '1024',
      name: 'my-test-function',
      requestId: 'bdb40738-ff36-48c0-9842-9befd0141cd6',
      requestTimeEpoch: '1659551935837',
      version: '$LATEST',
      outcome: 'OUTCOME_SUCCESS',
      apiGateway: {
        accountId: '012345678901',
        apiId: 'abc123',
        apiStage: 'dev',
        request: {
          id: '2e4d98fe-1603-477f-b976-1013e84ea4a6',
          headers: '',
          timeEpoch: '1659551935837',
          protocol: 'HTTP/1.1',
          domain: 'abc.example.com',
          method: 'GET',
          path: '/test',
        },
      },
    },
  },
};

const spanId = 'cc81e067-1cfb-4ff1-a69b-05a9484fffad';
const traceId = 'a6de3138-2c4e-43d1-94a0-05f24472e685';
const apiGatewayRequestId = '2e4d98fe-1603-477f-b976-1013e84ea4a6';
const lambdaRequestId = 'bdb40738-ff36-48c0-9842-9befd0141cd6';

const nanoNow = BigInt('1659551935837000000');
const milliNow = 1659551935837;

describe('span-schema', () => {
  it('should parse AWS Lambda Root Span', () => {
    const span = Span.toJSON({
      id: Buffer.from(spanId, 'utf-8'),
      traceId: Buffer.from(traceId, 'utf-8'),
      name: 'test',
      startTimeUnixNano: nanoNow,
      endTimeUnixNano: nanoNow,
      tags: {
        sls: {
          orgId: 'abc123',
          sdk: {
            name: 'aws-lambda-sdk',
            version: '0.0.1',
          },
          platform: 'lambda',
          region: 'us-east-1',
          service: 'my-test-function',
        },
        awsLambda: {
          arch: 'arm64',
          isColdstart: true,
          error: false,
          errorTimeout: false,
          eventSource: 'aws.apigatewayv2',
          eventType: 'aws.apigatewayv2',
          logGroup: 'abc12',
          logStreamName: 'abc123',
          maxMemory: 1024,
          name: 'my-test-function',
          requestId: lambdaRequestId,
          requestTimeEpoch: milliNow,
          version: '$LATEST',
          outcome: AwsLambdaTagsOutcome.OUTCOME_SUCCESS,
          apiGateway: {
            accountId: '012345678901',
            apiId: 'abc123',
            apiStage: 'dev',
            request: {
              method: 'GET',
              path: '/test',
              domain: 'abc.example.com',
              id: apiGatewayRequestId,
              protocol: 'HTTP/1.1',
              timeEpoch: milliNow,
              headers: '',
            },
          },
        },
      },
    });

    const parsedSpan = Span.toJSON(Span.fromJSON(expectedLambdaRootSpan));

    expect(span).to.deep.equal(parsedSpan);
  });
});
