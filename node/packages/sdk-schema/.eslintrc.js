'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/scripts/**', '**/test/**', 'prettier.config.js'],
        packageDir: [projectDir, path.resolve(projectDir, 'packages/aws-lambda-sdk')],
      },
    ],
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      rules: {
        'no-loop-func': 'off',
      },
    },
  ],
};
