'use strict';

module.exports.handler = (event, context, callback) => {
  console.log('with-internal 1');
  console.warn('with-internal warning 1');
  console.error(new Error('with-internal warning 1'));
  callback(null, 'ok');
};
