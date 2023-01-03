'use strict';

const isError = require('type/error/is');

const nodeConsole = console;

let isInstalled = false;
let uninstall;

module.exports.install = () => {
  if (isInstalled) return;
  isInstalled = true;

  const original = { error: nodeConsole.error };

  nodeConsole.error = function (...args) {
    try {
      const error = args.find(isError);
      if (!error) return;
      serverlessSdk.captureError(error);
    } finally {
      original.error.apply(this, args);
    }
  };

  uninstall = () => {
    nodeConsole.error = original.error;
  };
};

module.exports.uninstall = () => {
  if (!isInstalled) return;
  isInstalled = false;
  uninstall();
};

const serverlessSdk = require('../..');
