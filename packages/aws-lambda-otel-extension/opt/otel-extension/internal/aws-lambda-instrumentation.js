'use strict';

const { AwsLambdaInstrumentation } = require('@opentelemetry/instrumentation-aws-lambda');

AwsLambdaInstrumentation.prototype.init = function () {
  // Turn off lambda wrapping as introduced by this class due to its limitations
  if (AwsLambdaInstrumentation._instance) {
    throw new Error('Unexpected doubled initialization');
  }
  // Expose instance for our custom wrapping needs
  AwsLambdaInstrumentation._instance = this;
};

module.exports = AwsLambdaInstrumentation;
