'use strict';

const createCoreResources = require('./lib/create-core-resources');
const run = require('./lib/run');

const resolveUseCasesConfig = {
  node: require('./lib/resolve-use-cases-config/node'),
  python: require('./lib/resolve-use-cases-config/python'),
};

module.exports = async (options = {}) => {
  const coreConfig = {};
  await createCoreResources(coreConfig);

  const allUseCasesConfig = new Map([
    ...Array.from(await resolveUseCasesConfig.node(coreConfig, options)),
    ...Array.from(await resolveUseCasesConfig.python(coreConfig, options)),
  ]);

  const useCasesConfig = options.useCases
    ? new Map(Array.from(allUseCasesConfig).filter(([name]) => options.useCases.has(name)))
    : allUseCasesConfig;

  if (!useCasesConfig.size) throw new Error('No matching use case');

  return run(useCasesConfig, coreConfig, options);
};
