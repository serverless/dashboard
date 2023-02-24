'use strict';

// eslint-disable-next-line import/no-unresolved
const { Lambda } = require('aws-sdk');

const lambda = new Lambda();

module.exports.handler = async () => {
  await lambda.listFunctions({}, () => {}).promise();
  // Ensure that second resolution happens in scope of this invocation
  await new Promise((resolve) => setTimeout(resolve, 100));
  return 'ok';
};
