'use strict';

module.exports = (attributes) => {
  const result = Object.create(null);
  for (const {
    key,
    value: { stringValue, Value },
  } of attributes) {
    if (result[key] != null) throw new Error(`${key} already set`);
    result[key] = Value ? Value.StringValue : stringValue;
  }
  return result;
};
