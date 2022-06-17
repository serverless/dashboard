'use strict';

const path = require('path');
const _ = require('lodash');

const resolveNestedTestScenario = (parentTestConfig, [name, config]) => {
  if (config.cases) {
    const currentTestConfig = _.merge({}, parentTestConfig, config.config, {
      name: `${parentTestConfig.name}-${name}`,
    });
    return Array.from(config.cases, (child) => resolveNestedTestScenario(currentTestConfig, child));
  }
  return _.merge({}, parentTestConfig, config, { name: `${parentTestConfig.name}-${name}` });
};

module.exports = (functionsConfig, options = {}) => {
  const testScenarios = [];

  for (const [handlerModuleName, testConfigInput] of functionsConfig) {
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
      testScenarios.push(
        Array.from(cases, (child) => resolveNestedTestScenario(currentTestConfig, child))
      );
      continue;
    }
    testScenarios.push(_.merge(currentTestConfig, testConfigInput));
  }

  const result = testScenarios.flat(Infinity);
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
