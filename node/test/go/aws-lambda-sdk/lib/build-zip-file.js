'use strict';

const path = require('path');
const spawn = require('child-process-ext/spawn');
const resolveDirZipBuffer = require('../../../utils/resolve-dir-zip-buffer');

const slslambdaDirname = path.resolve(__dirname, '../../../../../go/packages/slslambda');
const fixturesDirname = path.resolve(slslambdaDirname, 'fixtures');

module.exports = function buildZipFile(functionName, architecture) {
  return async () => {
    const script = path.resolve(slslambdaDirname, 'scripts', 'build-go-binary.sh');
    const moduleDir = path.resolve(fixturesDirname, functionName);
    await spawn(script, [moduleDir, architecture]);
    const outputDir = path.resolve(moduleDir, 'build', architecture);
    const zipFile = await resolveDirZipBuffer(outputDir);
    const isArm64 = architecture === 'arm64';
    return {
      Handler: 'bootstrap',
      Runtime: isArm64 ? 'provided.al2' : 'go1.x',
      Architectures: isArm64 ? ['arm64'] : ['x86_64'],
      Code: { ZipFile: zipFile },
    };
  };
};
