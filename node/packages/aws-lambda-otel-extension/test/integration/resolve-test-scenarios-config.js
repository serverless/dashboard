'use strict';

const path = require('path');
const _ = require('lodash');

module.exports = (functionsConfig) => {
  const testScenariosConfig = [];

  for (const [handlerModuleName, testConfig] of functionsConfig) {
    const functionBasename = handlerModuleName.includes('/')
      ? path.dirname(handlerModuleName)
      : handlerModuleName;

    if (testConfig.cases) {
      const commonTestConfig = testConfig.testConfig;
      for (const [name, caseTestConfig] of testConfig.cases) {
        testScenariosConfig.push({
          functionConfig: {
            handlerModuleName,
            basename: `${functionBasename}-${name}`,
          },
          testConfig: _.merge({}, commonTestConfig, caseTestConfig),
        });
      }
    } else {
      testScenariosConfig.push({
        functionConfig: {
          handlerModuleName,
          basename: functionBasename,
        },
        testConfig,
      });
    }
  }

  return testScenariosConfig;
};
