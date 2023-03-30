'use strict';

const cleanup = require('../../lib/cleanup');
const basename = require('./basename');

module.exports = async (options = {}) =>
  cleanup(basename, { extraLayerNames: ['node-internal', 'python-internal'], ...options });
