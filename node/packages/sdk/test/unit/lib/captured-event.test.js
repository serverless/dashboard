'use strict';

const { expect } = require('chai');

const requireUncached = require('ncjsm/require-uncached');

describe('lib/captured-event.test.js', () => {
  let rootSpan;
  let TraceSpan;
  let CapturedEvent;
  let Tags;
  let Long;
  before(() => {
    process.env.SLS_CRASH_ON_SDK_ERROR = '1';
    requireUncached(() => {
      Long = require('long');
      TraceSpan = require('../../../lib/trace-span');
      CapturedEvent = require('../../../lib/captured-event');
      Tags = require('../../../lib/tags');
    });
    rootSpan = new TraceSpan('test');
  });
  after(() => {
    rootSpan.close();
  });

  describe('basic', () => {
    let capturedEvent;
    let customCapturedEvent;
    let timestamp;
    before(() => {
      capturedEvent = new CapturedEvent('test');
      timestamp = process.hrtime.bigint();
      customCapturedEvent = new CapturedEvent('test.custom', {
        timestamp,
        tags: { 'internal.tag': 'internal.value' },
        customTags: { 'user.tag': 'user.value' },
        customFingerprint: 'foo',
      });
    });

    it('should expose `name`', () => expect(capturedEvent.name).to.equal('test'));

    it('should automatically set `timestamp`', () =>
      expect(typeof capturedEvent.timestamp).to.equal('bigint'));

    it('should automatically generate `id`', () =>
      expect(typeof capturedEvent.id).to.equal('string'));

    it('should resolve current trace span', () =>
      expect(capturedEvent.traceSpan).to.equal(rootSpan));

    it('should expose tags', () => expect(capturedEvent.tags).to.be.instanceOf(Tags));

    it('should expose custom tags', () => expect(capturedEvent.customTags).to.be.instanceOf(Tags));

    it('should expose custom tags ', () => expect(capturedEvent.customTags).to.be.instanceOf(Tags));

    it('should support "timestamp" input', () =>
      expect(customCapturedEvent.timestamp).to.be.equal(timestamp));
    it('should support "tags" input', () =>
      expect(customCapturedEvent.tags.toJSON()).to.be.deep.equal({
        'internal.tag': 'internal.value',
      }));
    it('should support "customTags" input', () =>
      expect(customCapturedEvent.customTags.toJSON()).to.be.deep.equal({
        'user.tag': 'user.value',
      }));
    it('should support "customFingerprint" input', () =>
      expect(customCapturedEvent.customFingerprint).to.equal('foo'));

    it('should stringify to JSON', () => {
      const jsonValue = JSON.parse(JSON.stringify(customCapturedEvent));
      // Validate bigint valid values
      BigInt(jsonValue.timestamp);

      expect(jsonValue).to.deep.equal({
        id: customCapturedEvent.id,
        traceId: rootSpan.traceId,
        traceSpanId: rootSpan.id,
        name: 'test.custom',
        timestamp: jsonValue.timestamp,
        tags: { 'internal.tag': 'internal.value' },
        customTags: { 'user.tag': 'user.value' },
        customFingerprint: 'foo',
      });
    });

    it('should prepare Protobuf ready object', () => {
      const protoJson = customCapturedEvent.toProtobufObject();
      expect(Long.isLong(protoJson.timestampUnixNano)).to.be.true;
      expect(protoJson).to.deep.equal({
        id: Buffer.from(customCapturedEvent.id),
        traceId: Buffer.from(rootSpan.traceId),
        spanId: Buffer.from(rootSpan.id),
        eventName: 'test.custom',
        timestampUnixNano: protoJson.timestampUnixNano,
        tags: {
          internal: { tag: 'internal.value' },
        },
        customTags: JSON.stringify({ 'user.tag': 'user.value' }),
        customFingerprint: 'foo',
      });
    });

    it('should not throw on invalid user input', () => {
      delete process.env.SLS_CRASH_ON_SDK_ERROR;
      try {
        // eslint-disable-next-line no-new
        new CapturedEvent('test.custom', {
          customTags: { 'fooo': {}, 'W$#&^@#&$': 'raz' },
          customFingerprint: {},
        });
        // eslint-disable-next-line no-new
        new CapturedEvent('test.custom', {
          customFingerprint: {},
        });
      } finally {
        process.env.SLS_CRASH_ON_SDK_ERROR = '1';
      }
    });
  });
});
