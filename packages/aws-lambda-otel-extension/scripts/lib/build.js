'use strict';

const path = require('path');
const readdir = require('fs2/readdir');
const rmdir = require('fs2/rmdir');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const mkdir = require('fs2/mkdir');
const spawn = require('child-process-ext/spawn');

const rootDir = path.resolve(__dirname, '../../');
const optDir = path.resolve(rootDir, 'opt');
const otelExtensionDir = path.resolve(optDir, 'otel-extension');

module.exports = async (distFilename, options = {}) => {
  const zip = new AdmZip();
  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(path.dirname(distFilename), { intermediate: true, silent: true }),
    (async () => {
      if (!options.shouldSkipNpmInstall) {
        await rmdir(path.resolve(otelExtensionDir, 'node_modules'), {
          loose: true,
          recursive: true,
          force: true,
        });
        await spawn('npm', ['install'], { cwd: otelExtensionDir, stdio: 'inherit' });
        await unlink(path.resolve(otelExtensionDir, 'package-lock.json'));
      }
      for (const relativeFilename of await readdir(optDir, {
        depth: Infinity,
        type: { file: true },
      })) {
        zip.addLocalFile(path.resolve(optDir, relativeFilename), path.dirname(relativeFilename));
      }
    })(),
  ]);
  zip.writeZip(distFilename);
};
