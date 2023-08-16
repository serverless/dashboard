'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('index.test.js', () => {
  let serverlessSdk;
  let rootSpan;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
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
    delete process.env.SLS_CRASH_ON_SDK_ERROR;
    try {
      serverlessSdk.setTag();
    } finally {
      process.env.SLS_CRASH_ON_SDK_ERROR = '1';
    }
  });
});

describe('.createSpan', () => {
  let serverlessSdk;
  let rootSpan;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
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
  it('should expose .createSpan', () => {
    expect(serverlessSdk.createSpan).to.be.instanceOf(Object);
  });

  it('should create an implicit span using .createSpan with a single argument', () => {
    const span = serverlessSdk.createSpan('test');
    span.close();
    expect(span).to.be.instanceOf(Object);
    expect(span.name).to.equal('test');
    expect(span.parentSpan).to.equal(rootSpan);
    expect(span.endTime).to.not.be.undefined;
  });

  it('should create an sync encaspulated span using .createSpan', () => {
    const spans = [];
    serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => spans.push(traceSpan));
    const result = serverlessSdk.createSpan('test', () => {
      return 'test';
    });
    expect(spans.length).to.equal(1);
    expect(spans[0].name).to.equal('test');
    expect(spans[0].parentSpan).to.equal(rootSpan);
    expect(spans[0].endTime).to.not.be.undefined;
    expect(result).to.equal('test');
  });

  it('should create an async encaspulated span using .createSpan', async () => {
    const spans = [];
    serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => spans.push(traceSpan));
    const result = await serverlessSdk.createSpan('test', async () => {
      return new Promise((resolve) => resolve('test'));
    });
    expect(spans.length).to.equal(1);
    expect(spans[0].name).to.equal('test');
    expect(spans[0].parentSpan).to.equal(rootSpan);
    expect(spans[0].endTime).to.not.be.undefined;
    expect(result).to.equal('test');
  });

  it('should create nested spans using async context .createSpan', async () => {
    const spans = [];
    serverlessSdk._eventEmitter.on('trace-span-close', (traceSpan) => spans.push(traceSpan));
    const result = await serverlessSdk.createSpan('test.test1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await serverlessSdk.createSpan('test.test2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });
      return new Promise((resolve) => resolve('test'));
    });

    expect(spans.length).to.equal(2);
    expect(spans[0].name).to.equal('test.test2');
    expect(spans[1].parentSpan).to.equal(rootSpan);
    expect(spans[1].name).to.equal('test.test1');
    expect(spans[0].parentSpan).to.equal(spans[1]);
    expect(result).to.equal('test');
  });
});
