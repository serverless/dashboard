'use strict';

// eslint-disable-next-line import/no-unresolved
const { Lambda } = require('aws-sdk');

const lambda = new Lambda();

module.exports.handler = async () => {
  await lambda.listFunctions({}, () => {}).promise();
  return 'ok';
};
