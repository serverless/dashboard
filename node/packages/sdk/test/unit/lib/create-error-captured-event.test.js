'use strict';

const { expect } = require('chai');

const createCapturedErrorEvent = require('../../../create-error-captured-event');

describe('lib/create-captured-error-event.test.js', () => {
  it('should capture error', () => {
    const error = new Error('Test error');
    const event = createCapturedErrorEvent(error, { tags: { 'my.tag': 'whatever' } });
    expect(event.tags.toJSON()).to.deep.equal({
      'error.name': error.name,
      'error.message': error.message,
      'error.stacktrace': error.stack,
      'error.type': 2,
    });
    expect(event.customTags.toJSON()).to.deep.equal({
      'my.tag': 'whatever',
    });
  });

  it('should capture non error object', () => {
    const event = createCapturedErrorEvent({ foo: 'bar' });
    expect(event.tags.toJSON()).to.deep.equal({
      'error.name': 'object',
      'error.message': "{ foo: 'bar' }",
      'error.type': 2,
    });
  });

  it('should capture primitive', () => {
    const event = createCapturedErrorEvent('some message');
    expect(event.tags.toJSON()).to.deep.equal({
      'error.name': 'string',
      'error.message': 'some message',
      'error.type': 2,
    });
  });

  it('should capture "undfined"', () => {
    const event = createCapturedErrorEvent();
    expect(event.tags.toJSON()).to.deep.equal({
      'error.name': 'undefined',
      'error.message': 'undefined',
      'error.type': 2,
    });
  });
});