'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('index.test.js', () => {
  let serverlessSdk;
  let rootSpan;
  before(() => {
    requireUncached(() => {
      const TraceSpan = require('../../lib/trace-span');
      serverlessSdk = require('../../');
      // Ensure to trigger unerlying lazy require
      serverlessSdk.instrumentation.expressApp;
      rootSpan = new TraceSpan('test');
    });
  });
  after(() => {
    rootSpan.close();
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });
  before(() => {});
  it('should expose `.traceSpans`', () =>
    expect(serverlessSdk.traceSpans).to.be.instanceOf(Object));
  it('should expose .instrumentation.expressApp', () =>
    expect(typeof serverlessSdk.instrumentation.expressApp.install).to.equal('function'));
  it('should expose .captureError', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    serverlessSdk.captureError(new Error('My error'), { tags: { 'user.tag': 'somevalue' } });

    expect(capturedEvent.tags.get('error.message')).to.equal('My error');
    expect(capturedEvent.customTags.get('user.tag')).to.equal('somevalue');
  });
  it('should expose .captureWarning', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    serverlessSdk.captureWarning('Warning message', { tags: { 'user.tag': 'warningvalue' } });

    expect(capturedEvent.tags.get('warning.message')).to.equal('Warning message');
    expect(capturedEvent.customTags.get('user.tag')).to.equal('warningvalue');
  });

  it('should expose .setTag', () => {
    serverlessSdk.setTag('tag', 'value');
    expect(serverlessSdk._customTags.get('tag')).to.equal('value');
  });

  it('should not crash on invalid .setTag input', () => {
    serverlessSdk.setTag();
  });
});
