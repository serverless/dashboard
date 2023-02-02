'use strict';

const Module = require('module');
const reportError = require('../../report-error');

const installers = new Map();
const uninstallers = new Map();

const runInstall = (exports, relativeFilename, install) => {
  let uninstall;
  try {
    uninstall = install(exports);
  } catch (error) {
    reportError(error);
    return;
  }
  uninstallers.get(relativeFilename).add(uninstall);
};

Module.prototype.load = ((originalLoad) =>
  function (filename) {
    originalLoad.call(this, filename);
    for (const [relativeFilename, install] of installers.entries()) {
      if (filename.endsWith(relativeFilename)) {
        if (!uninstallers.has(relativeFilename)) uninstallers.set(relativeFilename, new Set());
        runInstall(this.exports, relativeFilename, install);
        return;
      }
    }
  })(Module.prototype.load);

module.exports.register = (relativeFilename, install) => {
  installers.set(relativeFilename, install);
  for (const [filename, moduleData] of Object.entries(require.cache)) {
    if (filename.endsWith(relativeFilename)) {
      if (!uninstallers.has(relativeFilename)) uninstallers.set(relativeFilename, new Set());
      runInstall(moduleData.exports, relativeFilename, install);
    }
  }
};

module.exports.unregister = (relativeFilename) => {
  if (uninstallers.has(relativeFilename)) {
    for (const uninstall of uninstallers.get(relativeFilename)) {
      try {
        uninstall();
      } catch (error) {
        reportError(error);
      }
    }
    uninstallers.delete(relativeFilename);
  }
  installers.delete(relativeFilename);
};
