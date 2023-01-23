'use strict';

const path = require('path');
const createCoreResources = require('../../../../lib/create-core-resources');

const basename = require('./basename');

module.exports = async (config, options = {}) => {
  const layersConfig = new Map();
  for (const layerType of options.layerTypes || ['internal', 'external']) {
    switch (layerType) {
      case 'external':
        if (process.env.TEST_EXTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_EXTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: () =>
              path.resolve(__dirname, '../../../../../../go/packages/dev-mode/dist/extension.zip'),
          });
        }
        break;
      case 'internal':
        if (process.env.TEST_INTERNAL_LAYER_FILENAME) {
          layersConfig.set(layerType, {
            build: () => path.resolve(process.env.TEST_INTERNAL_LAYER_FILENAME),
          });
        } else {
          layersConfig.set(layerType, {
            build: () =>
              path.resolve(
                __dirname,
                '../../../../../packages/aws-lambda-sdk/dist/extension.internal.zip'
              ),
          });
        }
        break;
      default:
        throw new Error(`Unrecognized layer type: ${layerType}`);
    }
  }
  return createCoreResources(basename, config, { layersConfig });
};
