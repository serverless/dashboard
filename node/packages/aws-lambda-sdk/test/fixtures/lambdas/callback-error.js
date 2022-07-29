'use strict';

module.exports.handler = (event, context, callback) => {
  callback(new Error('Handled'));
};
