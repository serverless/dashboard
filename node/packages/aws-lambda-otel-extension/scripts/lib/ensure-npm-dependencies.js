'use strict';

const path = require('path');
const semver = require('semver');
const memoizee = require('memoizee');

const rootPath = path.resolve(__dirname, '../../');

module.exports = memoizee(
  (dirname) => {
    const pkgJson = require(path.resolve(rootPath, dirname, 'package'));
    for (const [dependencyName, dependencyVersionRange] of Object.entries({
      ...(pkgJson.devDependencies || {}),
      ...(pkgJson.dependencies || {}),
    })) {
      const dependencyVersion = (() => {
        try {
          return require(path.resolve(
            rootPath,
            dirname,
            'node_modules',
            dependencyName,
            'package.json'
          )).version;
        } catch {
          throw new Error(
            `Outdated dependencies state at "${dirname}" ("${dependencyName}" is not installed). ` +
              'Please run "npm install"'
          );
        }
      })();
      if (!semver.satisfies(dependencyVersion, dependencyVersionRange)) {
        throw new Error(
          `Outdated dependencies state at "${dirname}" (unexpected version of "${dependencyName}" ). ` +
            'Please run "npm install"'
        );
      }
    }
  },
  { primitive: true }
);
