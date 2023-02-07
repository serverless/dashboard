'use strict';

const path = require('path');
const spawn = require('child-process-ext/spawn');

const esbuildFilename = path.resolve(__dirname, '../node_modules/.bin/esbuild');

module.exports = async (...args) => {
  try {
    return (await spawn(esbuildFilename, args)).stdoutBuffer;
  } catch (error) {
    throw new Error(`ESbuild errored: ${String(error.stdBuffer)}`);
  }
};
