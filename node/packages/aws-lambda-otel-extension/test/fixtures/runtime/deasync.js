'use strict';

const { callbackify } = require('util');
const deasync = require('deasync');

// deasyncify takes an async function and converts it to sync.
function deasyncify(p) {
  return deasync(callbackify(p));
}

module.exports.deasyncify = deasyncify;
