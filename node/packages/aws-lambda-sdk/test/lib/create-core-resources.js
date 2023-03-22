'use strict';

const path = require('path');
const buildLayer = require('../../scripts/lib/build');
const createCoreResources = require('../../../../test/lib/create-core-resources');

const buildDummyDevMode = require('../../../../test/lib/build-dummy-dev-mode-extension');
const basename = require('./basename');

module.exports = async (config, options = {}) => {
  const layersConfig = new Map();
  for (const layerType of options.layerTypes || ['internal', 'external']) {
    switch (layerType) {
      case 'internal':
        layersConfig.set(layerType, {
          build: async () => {
            const filename = path.resolve(__dirname, '../../dist/extension.internal.zip');
            await buildLayer(filename);
            return filename;
          },
        });
        break;
      case 'external':
        layersConfig.set(layerType, {
          build: buildDummyDevMode,
        });
        break;
      default:
        throw new Error(`Unrecognized layer type: ${layerType}`);
    }
  }
  return createCoreResources(basename, config, { layersConfig });
};
