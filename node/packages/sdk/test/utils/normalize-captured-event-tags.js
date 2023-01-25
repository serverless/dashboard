'use strict';

const { expect } = require('chai');

module.exports = (tags, prefix) => {
  const result = tags.toJSON();
  expect(result[`${prefix}.stacktrace`].startsWith('at ')).to.be.true;
  delete result[`${prefix}.stacktrace`];
  return result;
};
