'use strict';

const { expect } = require('chai');

describe('index.test.js', () => {
  let serverlessSdk;
  before(() => {
    serverlessSdk = require('../../');
  });
  it('should expose `.traceSpans`', () =>
    expect(serverlessSdk.traceSpans).to.be.instanceOf(Object));
  it('should expose .instrumentation.expressApp', () =>
    expect(typeof serverlessSdk.instrumentation.expressApp).to.equal('function'));
  it('should expose .captureError', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    serverlessSdk.captureError(new Error('My error'), { tags: { 'user.tag': 'somevalue' } });

    expect(capturedEvent.tags.get('error.message')).to.equal('My error');
    expect(capturedEvent.customTags.get('user.tag')).to.equal('somevalue');
  });
});
