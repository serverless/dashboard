'use strict';

module.exports.handler = (event, context, callback) => {
  console.log('with-internal 1');
  callback(null, 'ok');
};
