'use strict';

const _ = require('lodash');
const path = require('path');
const backendUrl = require('@serverless/utils/lib/auth/urls').backend;
const resolveFileZipBuffer = require('../../utils/resolve-file-zip-buffer');

const fixturesDirname = path.resolve(__dirname, '../../fixtures/lambdas');
const ingestionServerUrl = `${backendUrl}/ingestion/kinesis`;

module.exports = (benchmarkVariantsConfig, options) => {
  const allUseCasesConfig = new Map([
    [
      'callback',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'callback.js')),
            },
          },
        },
        variants: benchmarkVariantsConfig,
      },
    ],
    [
      'express',
      {
        config: {
          invokePayload: {
            version: '2.0',
            routeKey: '$default',
            rawPath: '/foo',
            rawQueryString: '',
            headers: {
              'accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'en-US,pl;q=0.7,en;q=0.3',
              'content-length': '0',
              'host': '1hqnqp4a70.execute-api.us-east-1.amazonaws.com',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'sec-fetch-user': '?1',
              'sec-gpc': '1',
              'upgrade-insecure-requests': '1',
              'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0',
              'x-amzn-trace-id': 'Root=1-624605c4-7fcc8fe9188a3cb762dcd189',
              'x-forwarded-for': '80.55.87.22',
              'x-forwarded-port': '443',
              'x-forwarded-proto': 'https',
            },
            requestContext: {
              accountId: '992311060759',
              apiId: '1hqnqp4a70',
              domainName: '1hqnqp4a70.execute-api.us-east-1.amazonaws.com',
              domainPrefix: '1hqnqp4a70',
              http: {
                method: 'GET',
                path: '/foo',
                protocol: 'HTTP/1.1',
                sourceIp: '80.55.87.22',
                userAgent:
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:98.0) Gecko/20100101 Firefox/98.0',
              },
              requestId: 'P3XWwjfgIAMEVFw=',
              routeKey: '$default',
              stage: '$default',
              time: '31/Mar/2022:19:49:24 +0000',
              timeEpoch: 1648756164620,
            },
            isBase64Encoded: false,
          },
        },
        variants: benchmarkVariantsConfig,
      },
    ],
    [
      '250ms',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, '250ms.js')),
            },
          },
        },
        variants: benchmarkVariantsConfig,
      },
    ],
    [
      '1s',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, '1s.js')),
            },
          },
        },
        variants: benchmarkVariantsConfig,
      },
    ],
    [
      'logger',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'logger.js')),
            },
            Timeout: 20,
          },
        },
        variants: (() =>
          new Map(
            Array.from(benchmarkVariantsConfig, ([name, caseConfig]) => {
              switch (name) {
                case 'jsonLog':
                case 'protoLog': {
                  const userSettings = JSON.parse(
                    caseConfig.configuration.Environment.Variables.SLS_OTEL_USER_SETTINGS
                  );
                  delete userSettings.logs;
                  return [
                    name,
                    _.merge({}, caseConfig, {
                      configuration: {
                        Environment: {
                          Variables: {
                            SLS_OTEL_USER_SETTINGS: JSON.stringify(userSettings),
                          },
                        },
                      },
                    }),
                  ];
                }
                case 'console': {
                  const userSettings = JSON.parse(
                    caseConfig.configuration.Environment.Variables.SLS_OTEL_USER_SETTINGS
                  );
                  userSettings.logs = { destination: `${ingestionServerUrl}/v1/logs` };
                  return [
                    name,
                    _.merge({}, caseConfig, {
                      configuration: {
                        Environment: {
                          Variables: {
                            SLS_OTEL_USER_SETTINGS: JSON.stringify(userSettings),
                          },
                        },
                      },
                    }),
                  ];
                }
                default:
                  return [name, caseConfig];
              }
            })
          ))(),
      },
    ],
  ]);

  return options.useCases
    ? new Map(Array.from(allUseCasesConfig).filter(([name]) => options.useCases.has(name)))
    : allUseCasesConfig;
};
