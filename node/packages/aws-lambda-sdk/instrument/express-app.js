'use strict';

const ensureObject = require('type/object/ensure');
const ensurePlainFunction = require('type/plain-function/ensure');
const instrumentLayerPrototype = require('../lib/instrument/express/instrument-layer-prototype');

const instrumentedApps = new WeakMap();

module.exports.install = (app) => {
  if (instrumentedApps.has(app)) return instrumentedApps.get(app);
  ensureObject(app, { errorMessage: '%v is not an instance of express app' });
  ensurePlainFunction(app.lazyrouter, {
    errorMessage: 'Passed argument is not an instance of express app',
  });
  app.lazyrouter();
  const uninstall = instrumentLayerPrototype(Object.getPrototypeOf(app._router.stack[0]));
  instrumentedApps.set(app, uninstall);
  return uninstall;
};

module.exports.uninstall = (app) => {
  const uninstall = instrumentedApps.get(app);
  if (uninstall) uninstall();
};
