'use strict';

const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const basename = require('./basename');
const getProcessFunction = require('../../lib/get-process-function');
const cleanup = require('./cleanup');
const runBenchmark = require('../../lib/benchmark/run');

module.exports = async (useCasesConfig, coreConfig, options = {}) =>
  runBenchmark({
    useCasesConfig,
    coreConfig,
    processFunction: await getProcessFunction(basename, coreConfig, {
      TracePayload,
      baseLambdaConfiguration: {},
      lambdaMemorySize: options.memorySize,
    }),
    cleanup,
  });
