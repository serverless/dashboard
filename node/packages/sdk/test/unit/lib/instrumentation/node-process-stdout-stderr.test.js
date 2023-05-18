'use strict';

const { expect } = require('chai');
const { Logger: PowertoolsLogger } = require('@aws-lambda-powertools/logger');
const pino = require('pino');
const winston = require('winston');
const bunyan = require('bunyan');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/instrumentation/node-process-stdout-stderr.js', () => {
  let serverlessSdk;
  let instrumentNodeConsole;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
    requireUncached(() => {
      serverlessSdk = require('../../../../');
      instrumentNodeConsole = require('../../../../lib/instrumentation/node-process-stdout-stderr');
      instrumentNodeConsole.install();
    });
  });
  after(() => {
    instrumentNodeConsole.uninstall();
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
  });

  describe('AWS Lambda Powertools', () => {
    it('should instrument error', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const logger = new PowertoolsLogger({
        serviceName: 'test-app',
        persistentLogAttributes: { testtag: 'test tag' },
      });

      logger.error('Test Error', new Error('My error'));
      expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
      expect(capturedEvent.tags.get('error.message')).to.equal('My error');
      expect(capturedEvent.customTags.get('service')).to.equal('test-app');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });

    it('should not instrument error string', () => {
      let capturedEvent = null;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const logger = new PowertoolsLogger({
        serviceName: 'test-app',
        persistentLogAttributes: { testtag: 'test tag' },
      });

      logger.error('Test Error');
      expect(capturedEvent).to.be.null;
    });

    it('should instrument warning', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const logger = new PowertoolsLogger({
        serviceName: 'test-app',
        persistentLogAttributes: { testtag: 'test tag' },
      });

      logger.warn('Test Warning');
      expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
      expect(capturedEvent.tags.get('warning.message')).to.equal('Test Warning');
      expect(capturedEvent.customTags.get('service')).to.equal('test-app');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });
  });
  describe('Pino', () => {
    it('should instrument error', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = pino();

      const logger = parent.child({ testtag: 'test tag' });

      logger.error(new Error('My error'));
      expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
      expect(capturedEvent.tags.get('error.message')).to.equal('My error');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });

    it('should instrument warning', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = pino();

      const logger = parent.child({ testtag: 'test tag' });

      logger.warn('Test Warning');
      expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
      expect(capturedEvent.tags.get('warning.message')).to.equal('Test Warning');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });
  });

  describe('Winston', () => {
    it('should instrument error', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = winston.createLogger({
        format: winston.format.json(),
        transports: [new winston.transports.Console()],
      });

      const logger = parent.child({ testtag: 'test tag' });

      const error = new Error('My error');
      error.name = 'WinstonError';
      logger.error('winston error', error);
      expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
      expect(capturedEvent.tags.get('error.message')).to.equal('winston error My error');
      expect(capturedEvent.tags.get('error.name')).to.equal('WinstonError');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });

    it('should instrument warning', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = winston.createLogger({
        format: winston.format.json(),
        transports: [new winston.transports.Console()],
      });

      const logger = parent.child({ testtag: 'test tag' });

      logger.warn('Test Warning');
      expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
      expect(capturedEvent.tags.get('warning.message')).to.equal('Test Warning');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });
  });

  describe('Bunyan', () => {
    it('should instrument error', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = bunyan.createLogger({ name: 'bunyan-test' });
      const logger = parent.child({ testtag: 'test tag' });

      const error = new Error('My error');
      error.name = 'BunyanError';
      logger.error(error, 'bunyan error');
      expect(capturedEvent.name).to.equal('telemetry.error.generated.v1');
      expect(capturedEvent.tags.get('error.message')).to.equal('My error');
      expect(capturedEvent.tags.get('error.name')).to.equal('BunyanError');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });

    it('should instrument warning', () => {
      let capturedEvent;
      serverlessSdk._eventEmitter.once('captured-event', (event) => (capturedEvent = event));

      const parent = bunyan.createLogger({ name: 'bunyan-test' });
      const logger = parent.child({ testtag: 'test tag' });

      logger.warn('Test Warning');
      expect(capturedEvent.name).to.equal('telemetry.warning.generated.v1');
      expect(capturedEvent.tags.get('warning.message')).to.equal('Test Warning');
      expect(capturedEvent.customTags.get('testtag')).to.equal('test tag');
      expect(capturedEvent._origin).to.equal('nodeConsole');
    });
  });
});
