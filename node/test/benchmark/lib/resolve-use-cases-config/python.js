'use strict';

const path = require('path');
const resolveFileZipBuffer = require('../../../utils/resolve-file-zip-buffer');
const cloneMap = require('../../../utils/clone-map');

const fixturesDirname = path.resolve(
  __dirname,
  '../../../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas'
);

module.exports = async (coreConfig) => {
  const benchmarkVariantsConfig = new Map([
    ['bare', null],
    [
      'consoleProd',
      {
        configuration: {
          Layers: [coreConfig.layerPythonInternalArn],
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-python/exec_wrapper.py',
              SLS_ORG_ID: process.env.SLS_ORG_ID,
              SLS_SDK_DEBUG: '1',
              SLS_CRASH_ON_SDK_ERROR: '1',
            },
          },
        },
      },
    ],
    [
      'external',
      {
        configuration: {
          Layers: [coreConfig.layerExternalArn],
          Environment: {
            Variables: { SLS_SDK_DEBUG: '1' },
          },
        },
      },
    ],
    [
      'consoleOfflineDevMode',
      {
        configuration: {
          Layers: [coreConfig.layerPythonInternalArn, coreConfig.layerExternalArn],
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-python/exec_wrapper.py',
              SLS_ORG_ID: process.env.SLS_ORG_ID,
              SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
              SLS_SDK_DEBUG: '1',
              SLS_CRASH_ON_SDK_ERROR: '1',
            },
          },
        },
      },
    ],
  ]);

  return new Map([
    [
      'pythonSuccess',
      {
        config: {
          configuration: {
            Handler: 'success.handler',
            Runtime: 'python3.9',
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'success.py')),
            },
          },
        },
        variants: cloneMap(benchmarkVariantsConfig),
      },
    ],
  ]);
};
