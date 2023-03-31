'use strict';

const buildZipFile = require('../../../go/aws-lambda-sdk/lib/build-zip-file');

module.exports = async () => {
  return new Map([
    [
      'goSuccess-bare-arm64',
      {
        deferredConfiguration: buildZipFile('bare', 'arm64'),
      },
    ],
    [
      'goSuccess-bare-amd64',
      {
        deferredConfiguration: buildZipFile('bare', 'amd64'),
      },
    ],
    [
      'goSuccess-consoleProd-arm64',
      {
        configuration: {
          Environment: {
            Variables: {
              SLS_ORG_ID: process.env.SLS_ORG_ID,
            },
          },
        },
        deferredConfiguration: buildZipFile('success', 'arm64'),
      },
    ],
    [
      'goSuccess-consoleProd-amd64',
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
