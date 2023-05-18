'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/report-notice.test.js', () => {
  let serverlessSdk;
  let reportNotice;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
    requireUncached(() => {
      serverlessSdk = require('../../..');
      reportNotice = require('../../../lib/report-notice');
    });
  });
  after(() => {
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });

  it('should report captured event for internal notice', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    reportNotice('Something occured', 'NOTICE_CODE');

    expect(capturedEvent.name).to.equal('telemetry.notice.generated.v1');
    expect(capturedEvent.tags.get('notice.message')).to.equal('Something occured');
    expect(capturedEvent.tags.get('notice.type')).to.equal(1);
    expect(capturedEvent.customFingerprint).to.equal('NOTICE_CODE');
  });
});
