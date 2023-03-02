'use strict';

const path = require('path');
const spawn = require('child-process-ext/spawn');
const createCoreResources = require('../../../lib/create-core-resources');

const buildDummyDevMode = require('../../../../packages/aws-lambda-sdk/test/lib/build-dummy-dev-mode-extension');
const basename = require('./basename');

const awsLambdaSdkDirname = path.resolve(
  __dirname,
  '../../../../../python/packages/aws-lambda-sdk'
);
const layerBuildScriptFilename = path.resolve(
  awsLambdaSdkDirname,
  'scripts/build-layer-archive.sh'
);

module.exports = async (config, options = {}) => {
  const layersConfig = new Map();
  for (const layerType of options.layerTypes || ['internal']) {
    switch (layerType) {
      case 'external':
        if (process.env.TEST_EXTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_EXTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, { build: buildDummyDevMode });
        }
        break;
      case 'internal':
        if (process.env.TEST_INTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_INTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: async () => {
              const filename = path.resolve(awsLambdaSdkDirname, 'dist/extension.internal.zip');
              await spawn(layerBuildScriptFilename, [filename]);
              return filename;
            },
          });
        }
        break;
      default:
        throw new Error(`Unrecognized layer type: ${layerType}`);
    }
  }
  return createCoreResources(basename, config, { layersConfig });
};
