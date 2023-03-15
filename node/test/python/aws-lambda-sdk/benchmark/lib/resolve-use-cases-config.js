'use strict';

const _ = require('lodash');
const path = require('path');
const resolveFileZipBuffer = require('../../../../utils/resolve-file-zip-buffer');

const fixturesDirname = path.resolve(
  __dirname,
  '../../../../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas'
);

const cloneMap = (map) => new Map(Array.from(map, ([key, value]) => [key, _.merge({}, value)]));

module.exports = (benchmarkVariantsConfig, options) => {
  const allUseCasesConfig = new Map([
    [
      'success',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'success.py')),
            },
          },
        },
        variants: cloneMap(benchmarkVariantsConfig),
      },
    ],
  ]);

  return options.useCases
    ? new Map(Array.from(allUseCasesConfig).filter(([name]) => options.useCases.has(name)))
    : allUseCasesConfig;
};
