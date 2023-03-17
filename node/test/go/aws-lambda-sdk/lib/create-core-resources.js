'use strict';

const createCoreResources = require('../../../lib/create-core-resources');

const basename = require('./basename');

module.exports = async (config) => {
  return createCoreResources(basename, config);
};
