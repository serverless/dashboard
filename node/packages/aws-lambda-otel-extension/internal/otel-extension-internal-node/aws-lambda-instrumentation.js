'use strict';

const { AwsLambdaInstrumentation } = require('@opentelemetry/instrumentation-aws-lambda');

AwsLambdaInstrumentation.prototype.init = function () {
  // Turn off lambda wrapping as introduced by this class due to its limitations
  if (AwsLambdaInstrumentation._instance) {
    throw new Error('Unexpected doubled initialization');
  }
  // Expose instance for our custom wrapping needs
  AwsLambdaInstrumentation._instance = this;
  // First part of a patch to prevent "No modules instrumentation has been defined" warning
  // It is reverted in temporarily overriden `enable()` method invoked right after `init()`
  return Array(1);
};

// Second part of patch to prevent "No modules instrumentation has been defined" warning
AwsLambdaInstrumentation.prototype.enable = function () {
  // Revert temporary patch (result of dummy response from `init()`)
  this._modules = [];
  delete AwsLambdaInstrumentation.prototype.enable;
  return this.enable();
};

module.exports = AwsLambdaInstrumentation;
