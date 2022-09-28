'use strict';

const Module = require('module');

const installers = new Map();
const uninstallers = new Map();

Module.prototype.load = ((originalLoad) =>
  function (filename) {
    originalLoad.call(this, filename);
    for (const [relativeFilename, install] of installers.entries()) {
      if (filename.endsWith(relativeFilename)) {
        if (!uninstallers.has(relativeFilename)) uninstallers.set(relativeFilename, new Set());
        uninstallers.get(relativeFilename).add(install(this.exports));
        return;
      }
    }
  })(Module.prototype.load);

module.exports.register = (relativeFilename, install) => {
  installers.set(relativeFilename, install);
  for (const [filename, moduleData] of Object.entries(require.cache)) {
    if (filename.endsWith(relativeFilename)) {
      if (!uninstallers.has(relativeFilename)) uninstallers.set(relativeFilename, new Set());
      uninstallers.get(relativeFilename).add(install(moduleData.exports));
    }
  }
};

module.exports.unregister = (relativeFilename) => {
  if (uninstallers.has(relativeFilename)) {
    for (const uninstall of uninstallers.get(relativeFilename)) uninstall();
    uninstallers.delete(relativeFilename);
  }
  installers.delete(relativeFilename);
};
