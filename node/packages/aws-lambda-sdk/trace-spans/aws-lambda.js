'use strict';

const TraceSpan = require('../lib/trace-span');

const awsLambdaSpan = new TraceSpan('aws.lambda', {
  startTime: EvalError.$serverlessAwsLambdaInitializationStartTime,
  immediateDescendants: ['aws.lambda.initialization'],
});

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
if (arch) awsLambdaSpan.tags.set('aws.lambda.arch', arch);

module.exports = awsLambdaSpan;
