'use strict';

const _ = require('lodash');
const path = require('path');
const resolveFileZipBuffer = require('../../../../../test/utils/resolve-file-zip-buffer');

const fixturesDirname = path.resolve(__dirname, '../../fixtures/lambdas');

const cloneMap = (map) => new Map(Array.from(map, ([key, value]) => [key, _.merge({}, value)]));

module.exports = (benchmarkVariantsConfig, options) => {
  const allUseCasesConfig = new Map([
    [
      'callback',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'callback.js')),
            },
          },
        },
        variants: cloneMap(benchmarkVariantsConfig),
      },
    ],

    [
      '250ms',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, '250ms.js')),
            },
          },
        },
        variants: cloneMap(benchmarkVariantsConfig),
      },
    ],
    [
      'requires',
      {
        configuration: {
          Timeout: 20,
        },
        variants: cloneMap(benchmarkVariantsConfig),
      },
    ],
  ]);

  return options.useCases
    ? new Map(Array.from(allUseCasesConfig).filter(([name]) => options.useCases.has(name)))
    : allUseCasesConfig;
};
