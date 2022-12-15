'use strict';

const { expect } = require('chai');

const Long = require('long');

const TraceSpan = require('../../../lib/trace-span');

describe('lib/trace-span.test.js', () => {
  let rootSpan;
  before(() => {
    rootSpan = new TraceSpan('test');
  });
  after(() => {
    rootSpan.close();
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
      childSpan = new TraceSpan('child').close();
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
    expect(new TraceSpan('child', { startTime }).close().startTime).to.equal(startTime);
  });

  it('should support initial `tags`', () => {
    expect(Array.from(new TraceSpan('child', { tags: { foo: 'bar' } }).close().tags)).to.deep.equal(
      [['foo', 'bar']]
    );
  });

  it('should support injection of `endTime`', () => {
    const childSpan = new TraceSpan('child');
    const endTime = process.hrtime.bigint();
    childSpan.close({ endTime });
    expect(childSpan.endTime).to.equal(endTime);
  });

  it('should support `input`', () => {
    expect(new TraceSpan('child', { input: 'foo' }).close().input).to.equal('foo');
  });

  it('should support `input`', () => {
    expect(new TraceSpan('child', { output: 'foo' }).close().output).to.equal('foo');
  });

  it('should support creation of immediate descendant spans', () => {
    const childSpan = new TraceSpan('child', {
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
    grandGrandChild.close();
    grandChild.close();
    childSpan.close();
  });

  it('should not close descendant spans on span closure', () => {
    const childSpan = new TraceSpan('child', {
      immediateDescendants: ['grandchild', 'grandgrandchild'],
    });
    const grandChild = Array.from(childSpan.subSpans)[0];
    const grandGrandChild = Array.from(grandChild.subSpans)[0];
    childSpan.close();

    expect(grandChild).to.not.have.property('endTime');
    expect(grandGrandChild).to.not.have.property('endTime');
    grandChild.close();
    grandGrandChild.close();
  });

  describe('spans', () => {
    it('should resolve just self when no subspans', () => {
      const span = new TraceSpan('child').close();
      expect(Array.from(span.spans)).to.deep.equal([span]);
    });

    it('should resolve self and all descendants', () => {
      const span = new TraceSpan('child');
      const subSpan = new TraceSpan('subchild');
      const subSubSpan = new TraceSpan('subsubchild').close();
      subSpan.close();
      expect(Array.from(span.close().spans)).to.deep.equal([span, subSpan, subSubSpan]);
    });
  });

  it('should stringify to JSON', () => {
    const childSpan = new TraceSpan('child');
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
    const childSpan = new TraceSpan('child');
    childSpan.input = 'some input';
    childSpan.output = 'some output';
    childSpan.tags.set('toptag', '1');
    childSpan.tags.set('top.nested', '2');
    childSpan.tags.set('top.deep.nested', '3');
    childSpan.tags.set('top_snake.deep_snake.nested_snake', '3');
    childSpan.tags.set('some.boolean', true);
    childSpan.tags.set('some.number', 123);
    childSpan.tags.set('some.strings', ['foo', 'bar']);
    childSpan.tags.set('some.numbers', [12, 23]);
    childSpan.close();
    const protoJson = childSpan.toProtobufObject();
    expect(protoJson).to.deep.equal({
      id: Buffer.from(childSpan.id),
      traceId: Buffer.from(childSpan.traceId),
      parentSpanId: Buffer.from(rootSpan.id),
      name: 'child',
      startTimeUnixNano: protoJson.startTimeUnixNano,
      endTimeUnixNano: protoJson.endTimeUnixNano,
      input: 'some input',
      output: 'some output',
      tags: {
        toptag: '1',
        top: { nested: '2', deep: { nested: '3' } },
        topSnake: { deepSnake: { nestedSnake: '3' } },
        some: {
          boolean: true,
          number: new Long(123, 0, true),
          strings: ['foo', 'bar'],
          numbers: [new Long(12, 0, true), new Long(23, 0, true)],
        },
      },
    });
    expect(Long.isLong(protoJson.startTimeUnixNano)).to.be.true;
    expect(Long.isLong(protoJson.endTimeUnixNano)).to.be.true;
  });
});
