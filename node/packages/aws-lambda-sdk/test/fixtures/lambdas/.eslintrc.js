'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../../../');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        packageDir: [projectDir, path.resolve(projectDir, 'test/fixtures/lambdas')],
      },
    ],
    'no-console': 'off',
  },
  ignorePatterns: ['esbuild-from-esm-callback.js'],
};
