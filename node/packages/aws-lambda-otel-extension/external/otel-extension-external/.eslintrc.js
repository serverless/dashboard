'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../../../../');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [],
        packageDir: [__dirname],
      },
    ],
  },
  ignorePatterns: ['proto.js'],
};
