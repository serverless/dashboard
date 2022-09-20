'use strict';

const cjsHook = require('../utils/cjs-hook');
const instrumentLayerPrototype = require('./instrument-layer-prototype');

module.exports.install = () =>
  cjsHook.register('/express/lib/router/layer.js', ({ prototype }) =>
    instrumentLayerPrototype.install(prototype)
  );

module.exports.uninstall = () => cjsHook.unregister('/express/lib/router/layer.js');
