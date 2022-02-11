#!/usr/bin/env node

'use strict';

require('chai');

require('essentials');

const path = require('path');
const readdir = require('fs2/readdir');
const unlink = require('fs2/unlink');
const mkdir = require('fs2/mkdir');
const AdmZip = require('adm-zip');

const rootDir = path.resolve(__dirname, '../');
const optDir = path.resolve(rootDir, 'opt');
const distDir = path.resolve(rootDir, 'dist');
const distFilename = path.resolve(distDir, 'extension.zip');

(async () => {
  const zip = new AdmZip();
  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(distDir, { silent: true }),
    (async () => {
      for (const relativeFilename of await readdir(optDir, {
        depth: Infinity,
        type: { file: true },
      })) {
        zip.addLocalFile(path.resolve(optDir, relativeFilename), path.dirname(relativeFilename));
      }
    })(),
  ]);
  zip.writeZip(distFilename);
})();
