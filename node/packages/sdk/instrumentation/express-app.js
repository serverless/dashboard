'use strict';

const ensureObject = require('type/object/ensure');
const ensurePlainFunction = require('type/plain-function/ensure');
const instrumentRouter = require('../lib/instrumentation/express/instrument-router');

const instrumentedApps = new WeakMap();

module.exports.install = (app) => {
  if (instrumentedApps.has(app)) return instrumentedApps.get(app);
  ensureObject(app, { errorMessage: '%v is not an instance of express app' });
  ensurePlainFunction(app.lazyrouter, {
    errorMessage: 'Passed argument is not an instance of express app',
  });
  app.lazyrouter();
  const uninstall = instrumentRouter.install(Object.getPrototypeOf(app._router));
  instrumentedApps.set(app, uninstall);
  return uninstall;
};

module.exports.uninstall = (app) => {
  const uninstall = instrumentedApps.get(app);
  if (uninstall) uninstall();
};
