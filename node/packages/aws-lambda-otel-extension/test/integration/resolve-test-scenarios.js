'use strict';

const path = require('path');
const _ = require('lodash');

const resolveNestedTestConfig = (parentTestConfig, [name, config]) => {
  if (config.cases) {
    const currentTestConfig = _.merge({}, parentTestConfig, config.config, {
      name: `${parentTestConfig.name}-${name}`,
    });
    return Array.from(config.cases, (child) => resolveNestedTestConfig(currentTestConfig, child));
  }
  return _.merge({}, parentTestConfig, config, { name: `${parentTestConfig.name}-${name}` });
};

module.exports = (functionVariantsConfig, options = {}) => {
  const testVariants = [];

  for (const [handlerModuleName, testConfigInput] of functionVariantsConfig) {
    const currentName = handlerModuleName.includes('/')
      ? path.dirname(handlerModuleName)
      : handlerModuleName;

    const currentTestConfig = _.merge(
      {
        name: currentName,
        configuration: { Handler: `${handlerModuleName}.handler` },
        expectedOutcome: 'success',
        invokeCount: 2,
        invokePayload: {},
      },
      options.commonTestConfig
    );
    const cases = testConfigInput.cases;
    if (cases) {
      _.merge(currentTestConfig, testConfigInput.config);
      testVariants.push(
        Array.from(cases, (child) => resolveNestedTestConfig(currentTestConfig, child))
      );
      continue;
    }
    testVariants.push(_.merge(currentTestConfig, testConfigInput));
  }

  const result = testVariants.flat(Infinity);
  if (!options.multiplyBy) return result;
  return result
    .map((testScenario) => {
      const multipliedResult = [];
      let counter = 1;
      do {
        multipliedResult.push(
          _.merge({}, testScenario, { name: `${testScenario.name}-${counter}` })
        );
      } while (++counter <= options.multiplyBy);
      return multipliedResult;
    })
    .flat();
};
