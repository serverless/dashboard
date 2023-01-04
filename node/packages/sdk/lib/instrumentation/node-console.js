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
    original.error.apply(this, args);
    const error = args.find(isError);
    if (!error) return;
    serverlessSdk.captureError(error);
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
