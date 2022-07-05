'use strict';

const { expect } = require('chai');

const _ = require('lodash');
const requireUncached = require('ncjsm/require-uncached');

describe('test/unit/external/user-settings.test.js', () => {
  let defaultConfig;

  const getUserConfig = () => requireUncached(() => require('../../../lib/user-settings'));

  before(() => {
    defaultConfig = getUserConfig();
  });
  afterEach(() => {
    delete process.env.SLS_OTEL_USER_SETTINGS;
  });
  it('should handle gently no data', () => {
    process.env.SLS_OTEL_USER_SETTINGS = JSON.stringify({
      common: { destination: { foo: 'bar' } },
      metrics: { destination: 'foo' },
    });
    expect(getUserConfig()).to.deep.equal(
      _.merge({}, defaultConfig, {
        common: { destination: { foo: 'bar' } },
        metrics: { destination: 'foo' },
      })
    );
  });
});
