'use strict';

module.exports.handler = () =>
  setTimeout(() => {
    throw new Error('Stop');
  });
