'use strict';

const path = require('path');
const mkdir = require('fs2/mkdir');
const AdmZip = require('adm-zip');

const defaultZipFilename = path.resolve(__dirname, '../dist/dummy-dev-mode.zip');
const layersDirname = path.resolve(__dirname, './layers');

module.exports = async (zipFilename = null, options = {}) => {
  if (!zipFilename) zipFilename = defaultZipFilename;
  await mkdir(path.dirname(zipFilename), { intermediate: true, silent: true });
  const zip = new AdmZip();
  zip.addLocalFile(
    path.resolve(layersDirname, 'dummy-dev-mode/dummy-dev-mode/index.js'),
    'dummy-dev-mode'
  );
  if (options.isRuntimeAgnostic) {
    zip.addLocalFile(
      path.resolve(layersDirname, 'dummy-dev-mode-runtime-agnostic/dummy-dev-mode/node'),
      'dummy-dev-mode'
    );
    zip.addLocalFile(
      path.resolve(layersDirname, 'dummy-dev-mode-runtime-agnostic/extensions/dummy-dev-mode.js'),
      'extensions'
    );
  } else {
    zip.addLocalFile(
      path.resolve(layersDirname, 'dummy-dev-mode/extensions/dummy-dev-mode.js'),
      'extensions'
    );
  }
  zip.writeZip(zipFilename);
  return zipFilename;
};
