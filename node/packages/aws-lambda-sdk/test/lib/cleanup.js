'use strict';

const cleanup = require('../../../../test/lib/cleanup');
const basename = require('./basename');

module.exports = async (options = {}) => cleanup(basename, options);
