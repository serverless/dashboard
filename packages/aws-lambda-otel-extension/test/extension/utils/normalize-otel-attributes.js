'use strict';

module.exports = (attributes) => {
  const result = Object.create(null);
  for (const {
    key,
    value: { stringValue },
  } of attributes) {
    if (result[key] != null) throw new Error(`${key} already set`);
    result[key] = stringValue;
  }
  return result;
};
