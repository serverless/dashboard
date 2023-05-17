'use strict';

const coerceNaturalNumber = require('type/natural-number/coerce');
const isApiEvent = require('./is-api-event');

const awsLambdaSpan = require('./sdk').traceSpans.awsLambda;

module.exports = (response) => {
  if (isApiEvent()) {
    if (awsLambdaSpan.tags.get('aws.lambda.response_mode' === 2)) return;
    let statusCode = response && response.statusCode;
    if (statusCode == null) {
      awsLambdaSpan.tags.set('aws.lambda.http.error_code', 'MISSING_STATUS_CODE');
      return;
    }
    if (typeof statusCode === 'string') statusCode = Number(statusCode);
    if (coerceNaturalNumber(statusCode) === statusCode && statusCode >= 100 && statusCode < 600) {
      awsLambdaSpan.tags.set('aws.lambda.http.status_code', statusCode);
    } else {
      awsLambdaSpan.tags.set('aws.lambda.http.error_code', 'INVALID_STATUS_CODE');
    }
  }
};
