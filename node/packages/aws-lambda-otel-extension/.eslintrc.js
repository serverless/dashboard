'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  parserOptions: { ecmaVersion: 2019 },
  globals: { BigInt: 'readonly', globalThis: 'readonly' },
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/test/**'],
        packageDir: [projectDir, path.resolve(projectDir, 'packages/aws-lambda-otel-extension')],
      },
    ],
  },
};
