'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/instrumentation/node-console.js', () => {
  let serverlessSdk;
  let instrumentNodeConsole;
  before(() => {
    requireUncached(() => {
      serverlessSdk = require('../../../../');
      instrumentNodeConsole = require('../../../../lib/instrumentation/node-console');
      instrumentNodeConsole.install();
    });
  });
  after(() => {
    instrumentNodeConsole.uninstall();
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });

  it('should instrument `console.error`', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    console.error(new Error('My error'));

    expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
    expect(capturedEvent.tags.get('error.message')).to.equal('My error');
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });

  it('should instrument multi argument call of `console.error`', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    console.error('Error was thrown:', new Error('My error'));

    expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
    expect(capturedEvent.tags.get('error.message').startsWith('Error was thrown: Error: My error'))
      .to.be.true;
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });

  it('should instrument `console.warn`', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    console.warn('My message', 12, true);

    expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
    expect(capturedEvent.tags.get('warning.message')).to.equal('My message 12 true');
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });

  it('should recognize Serverless SDK warning', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    console.warn({ source: 'serverlessSdk', message: 'Something is wrong' });

    expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
    expect(capturedEvent.tags.get('warning.message')).to.equal('Something is wrong');
    expect(capturedEvent.tags.get('warning.type')).to.equal(2);
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });
});
