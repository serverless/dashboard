'use strict';

const awsLambdaSpan = require('./sdk').traceSpans.awsLambda;

const apiEventTypes = new Set([
  'aws.apigateway.rest',
  'aws.apigatewayv2.http.v1',
  'aws.apigatewayv2.http.v2',
  'aws.lambda.url',
  'aws.elasticloadbalancing.http',
]);

module.exports = () => apiEventTypes.has(awsLambdaSpan.tags.get('aws.lambda.event_type'));
