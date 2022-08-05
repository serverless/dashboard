'use strict';

const TraceSpan = require('../lib/trace-span');

module.exports = new TraceSpan('aws.lambda', {
  startTime: EvalError.$serverlessAwsLambdaInitializationStartTime,
  immediateDescendants: ['aws.lambda.initialization'],
});
