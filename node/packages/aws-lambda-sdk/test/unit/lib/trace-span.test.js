'use strict';

const { expect } = require('chai');

const Long = require('long');

const TraceSpan = require('../../../lib/trace-span');

describe('lib/trace-span.test.js', () => {
  let rootSpan;
  before(() => {
    rootSpan = new TraceSpan('test');
  });

  describe('root span', () => {
    it('should automatically generate `traceId`', () =>
      expect(typeof rootSpan.traceId).to.equal('string'));

    it('should automatically generate `id`', () => expect(typeof rootSpan.id).to.equal('string'));

    it('should automatically set `startTime`', () =>
      expect(typeof rootSpan.startTime).to.equal('bigint'));

    it('should expose `name`', () => expect(rootSpan.name).to.equal('test'));
  });

  describe('sub span', () => {
    let childSpan;
    before(() => {
      childSpan = rootSpan.createSubSpan('child');
    });

    it('should expose `traceId` of a root span', () =>
      expect(childSpan.traceId).to.equal(rootSpan.traceId));

    it('should automatically generate unique `id`', () => {
      expect(typeof childSpan.id).to.equal('string');
      expect(childSpan.id).to.not.equal(rootSpan.id);
    });

    it('should automatically set `startTime`', () => {
      expect(typeof childSpan.startTime).to.equal('bigint');
      expect(childSpan.startTime).to.not.equal(rootSpan.startTime);
    });

    it('should expose `name`', () => expect(childSpan.name).to.equal('child'));
  });

  it('should support injection of `startTime`', () => {
    const startTime = process.hrtime.bigint();
    expect(rootSpan.createSubSpan('child', { startTime }).startTime).to.equal(startTime);
  });

  it('should support initial `tags`', () => {
    expect(
      Array.from(rootSpan.createSubSpan('child', { tags: { foo: 'bar' } }).tags)
    ).to.deep.equal([['foo', 'bar']]);
  });

  it('should support injection of `endTime`', () => {
    const childSpan = rootSpan.createSubSpan('child');
    const endTime = process.hrtime.bigint();
    childSpan.close({ endTime });
    expect(childSpan.endTime).to.equal(endTime);
  });

  it('should support creation of immediate descendant spans', () => {
    const childSpan = rootSpan.createSubSpan('child', {
      immediateDescendants: ['grandchild', 'grandgrandchild'],
    });
    const grandChildren = Array.from(childSpan.subSpans);
    expect(grandChildren.map(({ name }) => name)).to.deep.equal(['grandchild']);
    const grandChild = grandChildren[0];
    const grandGrandChildren = Array.from(grandChild.subSpans);
    expect(grandGrandChildren.map(({ name }) => name)).to.deep.equal(['grandgrandchild']);
    const grandGrandChild = grandGrandChildren[0];
    expect(grandChild.startTime).to.equal(childSpan.startTime);
    expect(grandGrandChild.startTime).to.equal(childSpan.startTime);
  });

  it('should close all descendant spans on span closure', () => {
    const childSpan = rootSpan.createSubSpan('child', {
      immediateDescendants: ['grandchild', 'grandgrandchild'],
    });
    const grandChild = Array.from(childSpan.subSpans)[0];
    const grandGrandChild = Array.from(grandChild.subSpans)[0];
    childSpan.close();

    expect(grandChild.endTime).to.equal(childSpan.endTime);
    expect(grandGrandChild.endTime).to.equal(childSpan.endTime);
  });

  describe('spans', () => {
    it('should resolve just self when no subspans', () => {
      const span = rootSpan.createSubSpan('child');
      expect(Array.from(span.spans)).to.deep.equal([span]);
    });

    it('should resolve self and all descendants', () => {
      const span = rootSpan.createSubSpan('child');
      const subSpan = span.createSubSpan('subchild');
      const subSubSpan = subSpan.createSubSpan('subsubchild');
      expect(Array.from(span.spans)).to.deep.equal([span, subSpan, subSubSpan]);
    });
  });

  it('should stringify to JSON', () => {
    const childSpan = rootSpan.createSubSpan('child');
    childSpan.tags.set('foo', 12);
    childSpan.close();
    const jsonValue = JSON.parse(JSON.stringify(childSpan));
    // Validate bigint valid values
    BigInt(jsonValue.startTime);
    BigInt(jsonValue.endTime);

    expect(jsonValue).to.deep.equal({
      traceId: rootSpan.traceId,
      id: childSpan.id,
      name: 'child',
      startTime: jsonValue.startTime,
      endTime: jsonValue.endTime,
      tags: { foo: 12 },
    });
  });

  it('should prepare Protobuf ready object', () => {
    const childSpan = rootSpan.createSubSpan('child');
    childSpan.tags.set('toptag', '1');
    childSpan.tags.set('top.nested', '2');
    childSpan.tags.set('top.deep.nested', '3');
    childSpan.tags.set('top_snake.deep_snake.nested_snake', '3');
    childSpan.tags.set('some.boolean', true);
    childSpan.tags.set('some.number', 123);
    childSpan.close();
    const protoJson = childSpan.toProtobufObject();
    expect(protoJson).to.deep.equal({
      id: Buffer.from(childSpan.id),
      traceId: Buffer.from(childSpan.traceId),
      parentSpanId: Buffer.from(rootSpan.id),
      name: 'child',
      startTimeUnixNano: protoJson.startTimeUnixNano,
      endTimeUnixNano: protoJson.endTimeUnixNano,
      tags: {
        toptag: '1',
        top: { nested: '2', deep: { nested: '3' } },
        topSnake: { deepSnake: { nestedSnake: '3' } },
        some: { boolean: true, number: new Long(123, 0, true) },
      },
    });
    expect(Long.isLong(protoJson.startTimeUnixNano)).to.be.true;
    expect(Long.isLong(protoJson.endTimeUnixNano)).to.be.true;
  });

  describe('tags', () => {
    it('should allow setting tags', () => {
      const childSpan = rootSpan.createSubSpan('child');
      childSpan.tags.set('bool', true);
      childSpan.tags.set('string', 'string');
      childSpan.tags.set('num', 23);
      expect(Array.from(childSpan.tags)).to.deep.equal([
        ['bool', true],
        ['string', 'string'],
        ['num', 23],
      ]);
    });

    it('should reject setting tag that alraedy exists', () => {
      const childSpan = rootSpan.createSubSpan('child');
      childSpan.tags.set('tag', true);
      expect(() => childSpan.tags.set('tag', 'again'))
        .to.throw(Error)
        .with.property('code', 'DUPLICATE_TRACE_SPAN_TAG_NAME');
    });
  });
});
