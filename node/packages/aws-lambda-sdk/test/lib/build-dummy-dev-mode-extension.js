'use strict';

const path = require('path');
const fsp = require('fs').promises;
const mkdir = require('fs2/mkdir');
const resolveDirZipBuffer = require('../utils/resolve-dir-zip-buffer');

const zipFilename = path.resolve(__dirname, '../../dist/dummy-dev-mode.zip');
const extensionDirname = path.resolve(__dirname, '../fixtures/dev-mode-extension');

module.exports = async () => {
  await mkdir(path.dirname(zipFilename), { intermediate: true, silent: true });
  await fsp.writeFile(zipFilename, await resolveDirZipBuffer(extensionDirname));
};
