'use strict';

const path = require('path');
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const basename = require('../../lib/basename');
const getProcessFunction = require('../../../../../test/lib/get-process-function');
const cleanup = require('../../lib/cleanup');
const runBenchmark = require('../../../../../test/lib/benchmark/run');

const fixturesDirname = path.resolve(
  __dirname,
  '../../../../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas'
);

module.exports = async (useCasesConfig, coreConfig) =>
  runBenchmark({
    useCasesConfig,
    coreConfig,
    processFunction: await getProcessFunction(basename, coreConfig, {
      TracePayload,
      fixturesDirname,
      baseLambdaConfiguration: {
        Runtime: 'python3.10',
        Layers: [coreConfig.layerInternalArn],
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-python/exec_wrapper.py',
          },
        },
      },
    }),
    cleanup,
  });
