'use strict';

const path = require('path');

const projectDir = path.resolve(__dirname, '../../../');

module.exports = {
  extends: path.resolve(projectDir, '.eslintrc.js'),
  overrides: [
    {
      files: ['index.js'],
      parserOptions: { ecmaVersion: 2020 },
    },
  ],
};
