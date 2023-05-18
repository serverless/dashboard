'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/report-warning.test.js', () => {
  let serverlessSdk;
  let reportWarning;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
    requireUncached(() => {
      serverlessSdk = require('../../..');
      reportWarning = require('../../../lib/report-warning');
    });
  });
  after(() => {
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });
  it('should report captured event for user warning', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    reportWarning('Something is wrong', 'WARN_CODE', { type: 'USER' });

    expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
    expect(capturedEvent.tags.get('warning.message')).to.equal('Something is wrong');
    expect(capturedEvent.tags.get('warning.type')).to.equal(2);
    expect(capturedEvent.customFingerprint).to.equal('WARN_CODE');
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });

  it('should report captured event for internal warning', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    reportWarning('Something is wrong', 'WARN_CODE');

    expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
    expect(capturedEvent.tags.get('warning.message')).to.equal('Something is wrong');
    expect(capturedEvent.tags.get('warning.type')).to.equal(3);
    expect(capturedEvent.customFingerprint).to.equal('WARN_CODE');
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });
});
