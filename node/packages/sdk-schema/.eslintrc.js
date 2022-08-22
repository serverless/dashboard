'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/rollup.config.js', '**/test/**'],
        packageDir: [projectDir, path.resolve(projectDir, 'packages/sdk-schema')],
      },
    ],
  },
  ignorePatterns: ['dist/**/*.js', 'out/**/*.js'],
};
