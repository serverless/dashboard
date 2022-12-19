'use strict';

const toLong = require('./to-long');

const resolveProtbufValue = (key, value) => {
  switch (key) {
    default:
      if (Array.isArray(value)) {
        if (typeof value[0] === 'number') return value.map(toLong);
        return value;
      }
      return typeof value === 'number' ? toLong(value) : value;
  }
};

const snakeToCamelCase = (string) =>
  string.replace(/_(.)/g, (ignore, letter) => letter.toUpperCase());

module.exports = (tags) => {
  const protobufTags = {};
  for (const [key, value] of tags) {
    let context = protobufTags;
    const keyTokens = key.split('.').map((token) => snakeToCamelCase(token));
    const lastToken = keyTokens.pop();
    for (const token of keyTokens) {
      if (!context[token]) context[token] = {};
      context = context[token];
    }
    context[lastToken] = resolveProtbufValue(key, value);
  }
  return protobufTags;
};
