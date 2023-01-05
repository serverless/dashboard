'use strict';

const { expect } = require('chai');
const instrumentNodeConsole = require('../../../../lib/instrumentation/node-console');

describe('lib/instrumentation/node-console.js', () => {
  let serverlessSdk;
  before(() => {
    serverlessSdk = require('../../../../');
    instrumentNodeConsole.install();
  });
  after(() => {
    instrumentNodeConsole.uninstall();
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

  it('should instrument `console.warn`', () => {
    let capturedEvent;
    serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));
    // eslint-disable-next-line no-console
    console.warn('My message', 12, true);

    expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
    expect(capturedEvent.tags.get('warning.message')).to.equal('My message 12 true');
    expect(capturedEvent._origin).to.equal('nodeConsole');
  });
});
