'use strict';

const path = require('path');
const _ = require('lodash');
const log = require('log').get('test');

const merge = (...objects) => {
  // _.merge breeks Buffers.
  // This patch ensures that we take expected configuration.Code.ZipFile buffer as is
  let configurationCode;
  for (const object of objects) {
    if (_.get(object, 'configuration.Code')) configurationCode = object.configuration.Code;
  }
  _.merge(...objects);
  if (configurationCode) objects[0].configuration.Code = configurationCode;
  return objects[0];
};

const resolveNestedTestConfig = (parentTestConfig, [name, config]) => {
  if (config.variants) {
    const currentTestConfig = merge({}, parentTestConfig, config.config, {
      name: `${parentTestConfig.name}-${name}`,
    });
    return Array.from(config.variants, (child) =>
      resolveNestedTestConfig(currentTestConfig, child)
    );
  }
  return merge({}, parentTestConfig, config, { name: `${parentTestConfig.name}-${name}` });
};

module.exports = (functionVariantsConfig, options = {}) => {
  const testVariants = [];

  for (const [handlerModuleName, testConfigInput] of functionVariantsConfig) {
    const currentName = handlerModuleName.includes('/')
      ? path.dirname(handlerModuleName)
      : handlerModuleName;

    const currentTestConfig = merge(
      {
        name: currentName,
        configuration: { Handler: `${handlerModuleName}.handler` },
        expectedOutcome: 'success',
        invokeCount: 2,
        invokePayload: {},
        hooks: {},
      },
      options.commonTestConfig
    );
    const variants = testConfigInput.variants;
    if (variants) {
      merge(currentTestConfig, testConfigInput.config);
      testVariants.push(
        Array.from(variants, (child) => resolveNestedTestConfig(currentTestConfig, child))
      );
      continue;
    }
    testVariants.push(merge(currentTestConfig, testConfigInput));
  }

  let result = testVariants.flat(Infinity);
  if (options.multiplyBy) {
    result = result
      .map((testScenario) => {
        const multipliedResult = [];
        let counter = 1;
        do {
          multipliedResult.push(
            merge({}, testScenario, { name: `${testScenario.name}-${counter}` })
          );
        } while (++counter <= options.multiplyBy);
        return multipliedResult;
      })
      .flat();
  }
  log.debug('Target test cases %o', result);
  return result;
};
