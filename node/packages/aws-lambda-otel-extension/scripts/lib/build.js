'use strict';

const path = require('path');
const readdir = require('fs2/readdir');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const mkdir = require('fs2/mkdir');
const ensureNpmDependencies = require('./ensure-npm-dependencies');
const { version } = require('../../package');

const rootDir = path.resolve(__dirname, '../../');
const externalDir = path.resolve(rootDir, 'external');
const externalRuntimeAgnosticDir = path.resolve(rootDir, 'external-runtime-agnostic');
const internalDir = path.resolve(rootDir, 'internal');

module.exports = async (distFilename, options = {}) => {
  if (!options) options = {};
  const mode = options.mode || 3; // 1: internal, 2: external
  const zip = new AdmZip();

  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(path.dirname(distFilename), { intermediate: true, silent: true }),
    (async () => {
      if (mode & 2) {
        ensureNpmDependencies('external/otel-extension-external');
        for (const relativeFilename of await readdir(externalDir, {
          depth: Infinity,
          type: { file: true },
        })) {
          if (mode === 2 && relativeFilename === 'extensions/otel-extension') continue;
          zip.addLocalFile(
            path.resolve(externalDir, relativeFilename),
            path.dirname(relativeFilename)
          );
        }
        if (mode === 2) {
          for (const relativeFilename of await readdir(externalRuntimeAgnosticDir, {
            depth: Infinity,
            type: { file: true },
          })) {
            zip.addLocalFile(
              path.resolve(externalRuntimeAgnosticDir, relativeFilename),
              path.dirname(relativeFilename)
            );
          }
        }
        zip.addFile(
          'otel-extension-external/version.json',
          Buffer.from(JSON.stringify(version), 'utf8')
        );
      }
      if (mode & 1) {
        ensureNpmDependencies('internal/otel-extension-internal-node');
        for (const relativeFilename of await readdir(internalDir, {
          depth: Infinity,
          type: { file: true },
        })) {
          zip.addLocalFile(
            path.resolve(internalDir, relativeFilename),
            path.dirname(relativeFilename)
          );
        }
      }
    })(),
  ]);
  zip.writeZip(distFilename);
};
