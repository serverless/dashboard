'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('test/unit/external/user-settings.test.js', () => {
  const getUserConfig = () => requireUncached(() => require('../../../lib/user-settings'));
  afterEach(() => {
    delete process.env.SLS_OTEL_USER_SETTINGS;
  });
  it('should handle gently no data', () => {
    process.env.SLS_OTEL_USER_SETTINGS = JSON.stringify({
      ingestToken: 'foo',
      logs: { disabled: true },
      foo: 'bar',
    });
    expect(getUserConfig()).to.deep.equal({
      ingestToken: 'foo',
      logs: { disabled: true },
      request: {},
      response: {},
      foo: 'bar',
    });
  });
});
