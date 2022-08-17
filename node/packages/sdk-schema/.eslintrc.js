'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/scripts/**', '**/test/**'],
        packageDir: [projectDir, path.resolve(projectDir, 'packages/sdk-schema')],
      },
    ],
  },
  ignorePatterns: ['rollup.config.js', 'dist/**/*.js', 'out/**/*.js'],
};
