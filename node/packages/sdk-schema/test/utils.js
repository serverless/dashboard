'use strict';

const normalizeObject = (obj) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) delete obj[key];
    else if (typeof value === 'object') normalizeObject(value);
  }
  return obj;
};

module.exports = { normalizeObject };
