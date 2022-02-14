'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../../../../');

module.exports = {
  extends: path.resolve(projectDir, 'package,json'),
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [],
        packageDir: [__dirname],
      },
    ],
  },
};
