'use strict';

const buildZipFile = require('../../../go/aws-lambda-sdk/lib/build-zip-file');

module.exports = async () => {
  return new Map([
    [
      'goSuccess-bare',
      {
        deferredConfiguration: buildZipFile('bare', 'amd64'),
      },
    ],
    [
      'goSuccess-consoleProd',
      {
        configuration: {
          Environment: {
            Variables: {
              SLS_ORG_ID: process.env.SLS_ORG_ID,
            },
          },
        },
        deferredConfiguration: buildZipFile('success', 'amd64'),
      },
    ],
  ]);
};
