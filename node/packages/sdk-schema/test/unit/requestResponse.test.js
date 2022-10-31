'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

const { expect } = require('chai');
const { normalizeObject } = require('../utils');

const { RequestResponse } = require(`${projectDir}/dist/index.cjs`);

const expectedRequestData = {
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
  traceId: Buffer.from('YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1'),
  spanId: Buffer.from('Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk'),
  requestId: '568fbbf3-e55c-494a-b00f-afab24ea4799',
  origin: 1,
  body: '{"message": "hello world"}',
};

const expectedResponseData = {
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
  traceId: Buffer.from('YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1'),
  spanId: Buffer.from('Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk'),
  requestId: '568fbbf3-e55c-494a-b00f-afab24ea4799',
  origin: 2,
  body: '{"processed": true}',
};

describe('request-response-schema', () => {
  it('should parse Request Data', () => {
    expect(expectedRequestData).to.deep.equal(
      normalizeObject(RequestResponse.decode(RequestResponse.encode(expectedRequestData).finish()))
    );
  });

  it('should parse Response Data', () => {
    expect(expectedResponseData).to.deep.equal(
      normalizeObject(RequestResponse.decode(RequestResponse.encode(expectedResponseData).finish()))
    );
  });
});
