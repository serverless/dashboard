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
});
