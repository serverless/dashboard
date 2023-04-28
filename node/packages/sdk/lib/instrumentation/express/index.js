'use strict';

const cjsHook = require('../utils/cjs-hook');
const instrumentRouter = require('./instrument-router');

module.exports.install = () =>
  cjsHook.register('/express/lib/router/index.js', (router) => instrumentRouter.install(router));

module.exports.uninstall = () => cjsHook.unregister('/express/lib/router/index.js');
