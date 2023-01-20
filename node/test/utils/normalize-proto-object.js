'use strict';

const { isLong } = require('long');

module.exports = (obj) => {
  const entries = Array.isArray(obj) ? obj.entries() : Object.entries(obj);
  for (const [key, value] of entries) {
    if (value == null) {
      delete obj[key];
    } else if (Array.isArray(value)) {
      module.exports(value);
    } else if (isLong(value)) {
      obj[key] = Number(String(value));
    } else if (typeof value === 'object') {
      module.exports(value);
    }
  }
  return obj;
};
