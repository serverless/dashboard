'use strict';

const createCoreResources = require('../lib/create-core-resources');
const resolveCommonBenchmarkVariantsConfig = require('./lib/resolve-common-benchmark-variants-config');
const resolveUseCasesConfig = require('./lib/resolve-use-cases-config');
const run = require('./lib/run');

module.exports = async (options = {}) => {
  const coreConfig = {};
  await createCoreResources(coreConfig, {
    layerTypes: ['nodeInternal', 'nodeExternal'],
  });

  const allBenchmarkVariantsConfig = await resolveCommonBenchmarkVariantsConfig(
    coreConfig,
    options
  );

  const benchmarkVariantsConfig = options.benchmarkVariants
    ? new Map(
        Array.from(allBenchmarkVariantsConfig).filter(([name]) =>
          options.benchmarkVariants.has(name)
        )
      )
    : allBenchmarkVariantsConfig;

  if (!benchmarkVariantsConfig.size) throw new Error('No matching benchmark variant');

  const useCasesConfig = resolveUseCasesConfig(benchmarkVariantsConfig, options);

  if (!useCasesConfig.size) throw new Error('No matching use case');

  return run(useCasesConfig, coreConfig);
};
