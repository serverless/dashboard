'use strict';

const path = require('path');
const spawn = require('child-process-ext/spawn');
const createCoreResources = require('../../lib/create-core-resources');

const buildDummyDevMode = require('../../lib/build-dummy-dev-mode-extension');
const basename = require('./basename');

const nodeAwsLambdaSdkDirname = path.resolve(__dirname, '../../../packages/aws-lambda-sdk');
const buildNodeLayer = require('../../../packages/aws-lambda-sdk/scripts/lib/build');

const pythonAwsLambdaSdkDirname = path.resolve(
  __dirname,
  '../../../../python/packages/aws-lambda-sdk'
);
const layerBuildScriptFilename = path.resolve(
  pythonAwsLambdaSdkDirname,
  'scripts/build-layer-archive.sh'
);

module.exports = async (config, options = {}) => {
  const layersConfig = new Map();
  for (const layerType of options.layerTypes || ['external', 'nodeInternal', 'pythonInternal']) {
    switch (layerType) {
      case 'external':
        if (process.env.TEST_EXTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_EXTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: () => buildDummyDevMode(null, { isRuntimeAgnostic: true }),
          });
        }
        break;
      case 'nodeInternal':
        if (process.env.TEST_NODE_INTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_NODE_INTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: async () => {
              const filename = path.resolve(nodeAwsLambdaSdkDirname, 'dist/extension.internal.zip');
              await buildNodeLayer(filename);
              return filename;
            },
          });
        }
        break;
      case 'pythonInternal':
        if (process.env.TEST_PYTHON_INTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_INTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: async () => {
              const filename = path.resolve(
                pythonAwsLambdaSdkDirname,
                'dist/extension.internal.zip'
              );
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
