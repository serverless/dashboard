'use strict';

const _ = require('lodash');

module.exports = (map) => new Map(Array.from(map, ([key, value]) => [key, _.merge({}, value)]));
