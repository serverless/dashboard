'use strict';

const path = require('path');
const readdir = require('fs2/readdir');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const mkdir = require('fs2/mkdir');
const ensureNpmDependencies = require('./ensure-npm-dependencies');
const { version } = require('../../package');

const rootDir = path.resolve(__dirname, '../../');
const optDir = path.resolve(rootDir, 'opt');

module.exports = async (distFilename) => {
  const zip = new AdmZip();
  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(path.dirname(distFilename), { intermediate: true, silent: true }),
    (async () => {
      ensureNpmDependencies('opt/otel-extension');
      for (const relativeFilename of await readdir(optDir, {
        depth: Infinity,
        type: { file: true },
      })) {
        zip.addLocalFile(path.resolve(optDir, relativeFilename), path.dirname(relativeFilename));
      }
    })(),
  ]);
  zip.addFile('otel-extension/version.json', Buffer.from(JSON.stringify(version), 'utf8'));
  zip.writeZip(distFilename);
};
