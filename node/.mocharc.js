'use strict';

module.exports = {
  require: [
    '@serverless/test/setup/patch',
    '@serverless/test/setup/log',
    '@serverless/test/setup/mock-homedir',
    '@serverless/test/setup/mock-cwd',
    '@serverless/test/setup/restore-env',
  ],
};
