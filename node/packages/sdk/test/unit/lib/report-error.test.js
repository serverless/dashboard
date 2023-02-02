'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/report-sdk-error.test.js', () => {
  let serverlessSdk;
  let reportError;
  let userErrorEvent;
  let internalErrorEvent;
  before(() => {
    requireUncached(() => {
      serverlessSdk = require('../../../');
      reportError = require('../../../lib/report-error');
      serverlessSdk._eventEmitter.once('captured-event', (event) => (userErrorEvent = event));
      reportError(new TypeError('Bad thing'), { type: 'USER' });
      serverlessSdk._eventEmitter.once('captured-event', (event) => (internalErrorEvent = event));
      reportError(new TypeError('Bad thing'));
    });
  });
  after(() => {
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });
  it('should report captured event for user error', () => {
    expect(userErrorEvent.name).to.equal('telemetry.error.generated.v1');
    expect(userErrorEvent.tags.get('error.message')).to.equal('Bad thing');
    expect(userErrorEvent.tags.get('error.type')).to.equal(3);
    expect(userErrorEvent.tags.get('error.name')).to.equal('TypeError');
    expect(userErrorEvent._origin).to.equal('nodeConsole');
  });

  it('should report captured event for user error', () => {
    expect(internalErrorEvent.name).to.equal('telemetry.error.generated.v1');
    expect(internalErrorEvent.tags.get('error.message')).to.equal('Bad thing');
    expect(internalErrorEvent.tags.get('error.type')).to.equal(4);
    expect(internalErrorEvent.tags.get('error.name')).to.equal('TypeError');
    expect(internalErrorEvent._origin).to.equal('nodeConsole');
  });
});
