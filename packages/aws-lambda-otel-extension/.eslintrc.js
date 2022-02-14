'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../..');

module.exports = {
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/scripts/**', '**/test/**', 'prettier.config.js'],
        packageDir: [projectDir, path.resolve(projectDir, 'packages/aws-lambda-otel-extension')],
      },
    ],
  },
};
