'use strict';

const isObject = require('type/object/is');

module.exports = (value) => {
  if (isObject(value)) return 'object';
  if (value === null) return 'null';
  return typeof value;
};
