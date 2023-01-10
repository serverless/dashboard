'use strict';

const { expect } = require('chai');

const createCapturedWarningEvent = require('../../../lib/create-warning-captured-event');

describe('lib/create-captured-warning-event.test.js', () => {
  it('should capture warning', () => {
    const event = createCapturedWarningEvent('Warning message', {
      tags: { 'my.tag': 'whatever' },
      fingerprint: 'foo',
    });
    expect(event.tags.toJSON()).to.deep.equal({
      'warning.message': 'Warning message',
    });
    expect(event.customTags.toJSON()).to.deep.equal({
      'my.tag': 'whatever',
    });
    expect(event.customFingerprint).to.deep.equal('foo');
  });
});
