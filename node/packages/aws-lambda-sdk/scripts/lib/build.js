'use strict';

const path = require('path');
const unlink = require('fs2/unlink');
const AdmZip = require('adm-zip');
const mkdir = require('fs2/mkdir');
const spawn = require('child-process-ext/spawn');

const rootDir = path.resolve(__dirname, '../../../../');
const packageDir = path.resolve(rootDir, 'packages/aws-lambda-sdk');
const esbuildFilename = path.resolve(rootDir, 'node_modules/.bin/esbuild');
const internalDir = path.resolve(packageDir, 'internal-extension');

const extensionDirname = 'sls-sdk-node';

const runEsbuild = async (...args) => {
  try {
    return (await spawn(esbuildFilename, args)).stdoutBuffer;
  } catch (error) {
    throw new Error(`ESbuild errored: ${String(error.stdBuffer)}`);
  }
};

module.exports = async (distFilename) => {
  const zip = new AdmZip();

  await Promise.all([
    unlink(distFilename, { loose: true }),
    mkdir(path.dirname(distFilename), { intermediate: true, silent: true }),
    (async () => {
      zip.addLocalFile(path.resolve(internalDir, 'exec-wrapper.sh'), extensionDirname);
      zip.addFile(
        `${extensionDirname}/index.js`,
        await runEsbuild(
          path.resolve(path.resolve(internalDir, 'index.js')),
          '--bundle',
          '--platform=node',
          '--external:@serverless/aws-lambda-sdk',
          '--external:../'
        )
      );
      zip.addFile(
        `${extensionDirname}/wrapper.js`,
        await runEsbuild(
          path.resolve(path.resolve(internalDir, 'wrapper.js')),
          '--bundle',
          '--platform=node',
          '--external:@serverless/aws-lambda-sdk',
          '--external:../../'
        )
      );
      zip.addFile(
        'nodejs/node_modules/@serverless/sdk/index.js',
        await runEsbuild(
          path.resolve(path.resolve(packageDir, 'index.js')),
          '--bundle',
          '--platform=node'
        )
      );
      zip.addFile(
        'nodejs/node_modules/@serverless/aws-lambda-sdk/index.js',
        Buffer.from("module.exports = require('@serverless/sdk')", 'utf8')
      );
    })(),
  ]);
  zip.writeZip(distFilename);
};
