'use strict';

const awsLambdaTraceSpan = require('./aws-lambda');

module.exports = awsLambdaTraceSpan.subSpans[Symbol.iterator]().next().value;
