'use strict';

const path = require('path');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const mkdir = require('fs2/mkdir');
const spawn = require('child-process-ext/spawn');

const rootDir = path.resolve(__dirname, '../../');
const esbuildFilename = path.resolve(rootDir, 'node_modules/.bin/esbuild');
const internalDir = path.resolve(rootDir, 'internal-extension');

const extensionDirname = 'sls-sdk-node';

module.exports = async (distFilename) => {
  const zip = new AdmZip();

  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(path.dirname(distFilename), { intermediate: true, silent: true }),
    (async () => {
      zip.addLocalFile(path.resolve(internalDir, 'exec-wrapper.sh'), extensionDirname);
      zip.addLocalFile(path.resolve(internalDir, 'index.js'), extensionDirname);
      zip.addFile(
        `${extensionDirname}/wrapper.js`,
        (
          await spawn(esbuildFilename, [
            path.resolve(path.resolve(internalDir, 'wrapper.js')),
            '--bundle',
            '--platform=node',
          ])
        ).stdoutBuffer
      );
    })(),
  ]);
  zip.writeZip(distFilename);
};
