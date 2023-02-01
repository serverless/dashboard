'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

const { expect } = require('chai');
const { normalizeObject } = require('../utils');
const Long = require('long');

const { Event, ErrorTags_ErrorType: ErrorType } = require(`${projectDir}/dist/index.cjs`);

const longValue = new Long('12313213', '12313221', true);

const expectedEventErrorData = {
  id: Buffer.from('MWNkNTllOWEyNmQwYTZhYTJkNGZkYmM3ZWM2NWNhZjU'),
  spanId: Buffer.from('YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1'),
  traceId: Buffer.from('Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk'),
  timestampUnixNano: longValue,
  eventName: 'telemetry.error.generated.v1',
  customTags: '{"testTag": "abc123"}',
  tags: {
    environment: 'dev',
    namespace: 'test',
    orgId: 'abc123',
    error: {
      name: 'testError',
      message: 'abc123',
      stacktrace: 'test',
      type: ErrorType.ERROR_TYPE_CAUGHT_USER,
    },
    sdk: {
      name: '@serverless/aws-lambda-sdk',
      version: '0.0.1',
    },
  },
};

describe('event-schema', () => {
  it('should parse Event Error Data', () => {
    expect(expectedEventErrorData).to.deep.equal(
      normalizeObject(Event.decode(Event.encode(expectedEventErrorData).finish()))
    );
  });
});
