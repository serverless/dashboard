'use strict';

const coerceNaturalNumber = require('type/natural-number/coerce');

const awsLambdaSpan = require('./sdk').traceSpans.awsLambda;

module.exports = (response) => {
  switch (awsLambdaSpan.tags.get('aws.lambda.event_type')) {
    case 'aws.apigateway.rest':
    case 'aws.apigatewayv2.http.v1':
    case 'aws.apigatewayv2.http.v2':
    case 'aws.lambda.url':
      {
        let statusCode = response && response.statusCode;
        if (statusCode == null) {
          awsLambdaSpan.tags.set('aws.lambda.http.error_code', 'MISSING_STATUS_CODE');
          break;
        }
        if (typeof statusCode === 'string') statusCode = Number(statusCode);
        if (
          coerceNaturalNumber(statusCode) === statusCode &&
          statusCode >= 100 &&
          statusCode < 600
        ) {
          awsLambdaSpan.tags.set('aws.lambda.http.status_code', statusCode);
        } else {
          awsLambdaSpan.tags.set('aws.lambda.http.error_code', 'INVALID_STATUS_CODE');
        }
      }
      break;
    default:
  }
};
