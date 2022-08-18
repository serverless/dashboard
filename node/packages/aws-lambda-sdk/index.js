'use strict';

module.exports.orgId = process.env.SLS_ORG_ID;

module.exports.traceSpans = {
  awsLambda: require('./trace-spans/aws-lambda'),
  awsLambdaInitialization: require('./trace-spans/aws-lambda-initialization'),
};
