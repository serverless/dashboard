'use strict';

const TraceSpan = require('../lib/trace-span');

const immutableTags = {
  'aws.lambda.name': process.env.AWS_LAMBDA_FUNCTION_NAME,
  'aws.lambda.version': process.env.AWS_LAMBDA_FUNCTION_VERSION,
};

const arch = (() => {
  switch (process.arch) {
    case 'x64':
      return 'x86_64';
    case 'arm64':
      return 'arm64';
    default:
      process.stderr.write(`Serverless SDK Error: Unrecognized architecture: "${process.arch}"\n`);
      return null;
  }
})();
if (arch) immutableTags['aws.lambda.arch'] = arch;

const awsLambdaSpan = new TraceSpan('aws.lambda', {
  startTime: EvalError.$serverlessAwsLambdaInitializationStartTime,
  immediateDescendants: ['aws.lambda.initialization'],
  tags: immutableTags,
});

if (process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'on-demand') {
  awsLambdaSpan.tags.set('aws.lambda.is_coldstart', true);
}

awsLambdaSpan.tags.reset = function () {
  this.clear();
  for (const [name, value] of Object.entries(immutableTags)) this.set(name, value);
};

module.exports = awsLambdaSpan;
