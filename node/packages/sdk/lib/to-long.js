'use strict';

const Long = require('long');

module.exports = (value) => {
  const data = Long.fromString(String(value));
  return new Long(data.low, data.high, true);
};
