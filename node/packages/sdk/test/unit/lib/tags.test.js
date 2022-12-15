'use strict';

const { expect } = require('chai');

const Tags = require('../../../lib/tags');

describe('lib/tags.test.js', () => {
  it('should allow setting tags', () => {
    const tags = new Tags();
    tags.set('bool', true);
    tags.set('string', 'string');
    tags.set('num', 23);
    tags.set('strings', ['foo', 'bar']);
    tags.set('numbers', [1, 2]);
    expect(Array.from(tags)).to.deep.equal([
      ['bool', true],
      ['string', 'string'],
      ['num', 23],
      ['strings', ['foo', 'bar']],
      ['numbers', [1, 2]],
    ]);
  });

  it('should support setting many tags at once', () => {
    const tags = new Tags();
    tags.setMany({ bool: true, string: 'string', num: 23, novalue: null });
    tags.setMany({ bool: true, string: 'string', num: 23, novalue: null }, { prefix: 'foo.bar' });
    expect(Array.from(tags)).to.deep.equal([
      ['bool', true],
      ['string', 'string'],
      ['num', 23],
      ['foo.bar.bool', true],
      ['foo.bar.string', 'string'],
      ['foo.bar.num', 23],
    ]);
  });

  it('should reject setting with different value tag that alraedy exists', () => {
    const tags = new Tags();
    tags.set('tag', true);
    expect(() => tags.set('tag', 'again'))
      .to.throw(Error)
      .with.property('code', 'DUPLICATE_TRACE_SPAN_TAG_NAME');
  });

  it('should ignore resetting tag with same value', () => {
    const tags = new Tags();
    tags.set('tag', true);
    expect(tags.set('tag', true)).to.equal(tags);
  });
});
