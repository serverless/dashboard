'use strict';

const { expect } = require('chai');

const createCapturedWarningEvent = require('../../../lib/create-warning-captured-event');
const normalizeTags = require('../../utils/normalize-captured-event-tags');

describe('lib/create-captured-warning-event.test.js', () => {
  it('should capture warning', () => {
    const event = createCapturedWarningEvent('Warning message', {
      tags: { 'my.tag': 'whatever' },
      fingerprint: 'foo',
    });
    expect(normalizeTags(event.tags, 'warning')).to.deep.equal({
      'warning.message': 'Warning message',
      'warning.type': 1,
    });
    expect(event.customTags.toJSON()).to.deep.equal({
      'my.tag': 'whatever',
    });
    expect(event.customFingerprint).to.deep.equal('foo');
  });
});
