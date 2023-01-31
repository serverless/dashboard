'use strict';

module.exports.handler = (event, context, callback) => {
  // The callback should never get called
  setTimeout(() => {
    callback(null, 'ok');
  }, 10 * 1000);
};
