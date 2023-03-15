'use strict';

const path = require('path');
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const basename = require('../../lib/basename');
const getProcessFunction = require('../../../../../test/lib/get-process-function');
const cleanup = require('../../lib/cleanup');
const runBenchmark = require('../../../../../test/lib/benchmark/run');

const fixturesDirname = path.resolve(__dirname, '../../fixtures/lambdas');

module.exports = async (useCasesConfig, coreConfig) =>
  runBenchmark({
    useCasesConfig,
    coreConfig,
    processFunction: await getProcessFunction(basename, coreConfig, {
      TracePayload,
      fixturesDirname,
      baseLambdaConfiguration: {
        Runtime: 'nodejs16.x',
        Layers: [coreConfig.layerInternalArn],
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
          },
        },
      },
    }),
    cleanup,
  });
