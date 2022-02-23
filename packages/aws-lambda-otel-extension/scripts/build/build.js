'use strict';

const path = require('path');
const fsp = require('fs').promises;
const readdir = require('fs2/readdir');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const spawn = require('child-process-ext/spawn');
const pkgJson = require('../../package');

const rootDir = path.resolve(__dirname, '../../');
const optDir = path.resolve(rootDir, 'opt');
const otelExtensionDir = path.resolve(optDir, 'otel-extension');
const distDir = path.resolve(rootDir, '../aws-lambda-otel-extension-dist');
const distFilename = path.resolve(distDir, 'extension.zip');

module.exports = async () => {
  const zip = new AdmZip();
  await Promise.all([
    unlink(distFilename, { loose: true }),
    (async () => {
      await spawn('npm', ['install'], { cwd: otelExtensionDir, stdio: 'inherit' });
      await unlink(path.resolve(otelExtensionDir, 'package-lock.json'));
      for (const relativeFilename of await readdir(optDir, {
        depth: Infinity,
        type: { file: true },
      })) {
        zip.addLocalFile(path.resolve(optDir, relativeFilename), path.dirname(relativeFilename));
      }
    })(),
    (async () => {
      const distPkgJsonPath = path.resolve(distDir, 'package.json');
      await unlink(distPkgJsonPath, { loose: true });
      await fsp.writeFile(
        distPkgJsonPath,
        JSON.stringify(
          {
            name: '@serverless/aws-lambda-otel-extension-dist',
            version: pkgJson.version,
            publishConfig: { access: 'public' },
            license: 'MIT',
          },
          null,
          2
        )
      );
    })(),
  ]);
  zip.writeZip(distFilename);
};

module.exports.distFilename = distFilename;
