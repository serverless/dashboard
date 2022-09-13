'use strict';

const serverlessSdk = module.exports;

serverlessSdk.traceSpans = {
  awsLambda: require('./trace-spans/aws-lambda'),
  awsLambdaInitialization: require('./trace-spans/aws-lambda-initialization'),
};
serverlessSdk._settings = {};

const isObject = require('type/object/is');
const ensureString = require('type/string/ensure');

const resolveSettings = (options = {}) => {
  if (!isObject(options)) options = {};
  serverlessSdk.orgId =
    process.env.SLS_ORG_ID ||
    ensureString(options.orgId, { isOptional: true, name: 'options.orgId' });
};

let isInitialized = false;
serverlessSdk.initialize = (options = {}) => {
  if (isInitialized) return module.exports;
  isInitialized = true;
  resolveSettings(options);

  // Auto generate HTTP(S) request spans
  require('./lib/instrument/http').install();

  return serverlessSdk;
};
