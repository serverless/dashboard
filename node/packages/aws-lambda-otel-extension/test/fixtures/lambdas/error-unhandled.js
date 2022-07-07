'use strict';

module.exports.handler = () =>
  setTimeout(() => {
    throw new Error('SLS Unhandled error');
  }, 500);
