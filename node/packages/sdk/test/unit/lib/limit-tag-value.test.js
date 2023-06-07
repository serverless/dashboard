'use strict';

const { expect } = require('chai');

const maxTagValueLength = require('../../../lib/max-tag-value-length');
const limitTagValue = require('../../../lib/limit-tag-value');

describe('lib/limit-tag-value.test.js', () => {
  it('should pass through strings below limit', () => {
    expect(limitTagValue('foo')).to.equal('foo');
    expect(limitTagValue('x'.repeat(maxTagValueLength)).length).to.equal(maxTagValueLength);
  });

  it('should trim strings exceeding the limit', () => {
    expect(limitTagValue('x'.repeat(maxTagValueLength + 1)).length).to.equal(maxTagValueLength);
  });
});
