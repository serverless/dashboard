'use strict';

module.exports = {
  extends: '@serverless/eslint-config/node',
  root: true,
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'scripts/**',
          'lib/**',
          'test/**',
          'commitlint.config',
          'prettier.config.js',
        ],
      },
    ],
  },
};
