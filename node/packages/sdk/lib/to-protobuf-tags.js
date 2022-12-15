'use strict';

const toLong = require('./to-long');

const resolvePorotbufValue = (key, value) => {
  switch (key) {
    // enum cases
    case 'aws.lambda.outcome':
      switch (value) {
        case 'success':
          return 1;
        case 'error:handled':
          return 5;
        default:
          // Will error in tests
          return null;
      }
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
    context[lastToken] = resolvePorotbufValue(key, value);
  }
  return protobufTags;
};
