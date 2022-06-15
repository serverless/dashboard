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

module.exports = (functionsConfig) => {
  const testScenarios = [];

  for (const [handlerModuleName, testConfigInput] of functionsConfig) {
    const currentName = handlerModuleName.includes('/')
      ? path.dirname(handlerModuleName)
      : handlerModuleName;

    const currentTestConfig = {
      name: currentName,
      configuration: { Handler: `${handlerModuleName}.handler` },
      expectedOutcome: 'success',
      invokePayload: {},
    };
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

  return testScenarios.flat(Infinity);
};
