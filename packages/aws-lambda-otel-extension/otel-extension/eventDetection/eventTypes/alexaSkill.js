'use strict';

const get = require('lodash.get');

module.exports = function eventType(e) {
  const type = 'aws.alexaskill';
  return get(e, 'session.attributes') &&
    get(e, 'session.user') &&
    get(e, 'context.System') &&
    get(e, 'request.requestId')
    ? type
    : false;
};
