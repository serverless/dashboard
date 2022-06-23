'use strict';

const _ = require('lodash');
const path = require('path');
const apiRequest = require('@serverless/utils/api-request');
const backendUrl = require('@serverless/utils/lib/auth/urls').backend;
const createCoreResources = require('../lib/create-core-resources');
const resolveTestVariantsConfig = require('../lib/resolve-test-variants-config');
const processFunction = require('../lib/process-function');
const cleanup = require('../lib/cleanup');
const resolveFileZipBuffer = require('../utils/resolve-file-zip-buffer');
const { median, average } = require('../utils/stats');
const log = require('log').get('test');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');
const ingestionServerUrl = `${backendUrl}/ingestion/kinesis`;
const service = 'benchmark';
const stage = 'test';

const resolveIngestionData = async () => {
  const orgToken = process.env.SLS_ORG_TOKEN;
  const orgName = process.env.SLS_ORG_NAME;

  if (!orgToken) {
    log.warn('No SLS_ORG_TOKEN provided - reporting to ingestion server will not be benchmarked');
    return {};
  }
  if (!orgName) {
    log.warn('No SLS_ORG_NAME provided - reporting to ingestion server will not be benchmarked');
    return {};
  }
  const orgId = (await apiRequest(`/api/identity/orgs/name/${orgName}`)).orgId;

  const token = (
    await apiRequest(`/ingestion/kinesis/org/${orgId}/service/${service}/stage/${stage}`)
  ).token.accessToken;

  await apiRequest('/ingestion/kinesis/token', {
    method: 'PATCH',
    body: { orgId, serviceId: service, stage, token },
  });

  return { token, orgId };
};

module.exports = async (options = {}) => {
  const allBenchmarkVariantsConfig = new Map([
    [
      'bare',
      {
        configuration: {
          Layers: [],
          Environment: { Variables: {} },
        },
      },
    ],
    [
      'externalOnly',
      {
        configuration: {
          Environment: {
            Variables: {
              SLS_OTEL_USER_SETTINGS: JSON.stringify({ logs: { disabled: true } }),
              DEBUG_SLS_OTEL_LAYER: '1',
            },
          },
        },
      },
    ],
    [
      'jsonLog',
      {
        configuration: {
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
              DEBUG_SLS_OTEL_LAYER: '1',
              SLS_OTEL_USER_SETTINGS: JSON.stringify({
                logs: { disabled: true },
                metrics: { outputType: 'json' },
                traces: { outputType: 'json' },
              }),
            },
          },
        },
      },
    ],
    [
      'protoLog',
      {
        configuration: {
          Environment: {
            Variables: {
              AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
              DEBUG_SLS_OTEL_LAYER: '1',
              SLS_OTEL_USER_SETTINGS: JSON.stringify({
                logs: { disabled: true },
              }),
            },
          },
        },
      },
    ],
  ]);

  const { token, orgId } = await resolveIngestionData();
  if (token) {
    allBenchmarkVariantsConfig.set('protoConsole', {
      configuration: {
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-extension-internal-node/exec-wrapper.sh',
            DEBUG_SLS_OTEL_LAYER: '1',
            OTEL_RESOURCE_ATTRIBUTES: `sls_service_name=${service},sls_stage=${stage},sls_org_id=${orgId}`,
            SLS_OTEL_USER_SETTINGS: JSON.stringify({
              common: { destination: { requestHeaders: `serverless_token=${token}` } },
              logs: { disabled: true },
              metrics: { destination: `${ingestionServerUrl}/v1/metrics` },
              request: { destination: `${ingestionServerUrl}/v1/request-response` },
              response: { destination: `${ingestionServerUrl}/v1/request-response` },
              traces: { destination: `${ingestionServerUrl}/v1/traces` },
            }),
          },
        },
      },
    });
  }

  const benchmarkVariantsConfig = options.benchmarkVariants
    ? new Map(
        Array.from(allBenchmarkVariantsConfig).filter(([name]) =>
          options.benchmarkVariants.has(name)
        )
      )
    : allBenchmarkVariantsConfig;

  if (!benchmarkVariantsConfig.size) throw new Error('No matching benchmark variant');

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
                case 'protoConsole': {
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

  const useCasesConfig = options.useCases
    ? new Map(Array.from(allUseCasesConfig).filter(([name]) => options.useCases.has(name)))
    : allUseCasesConfig;

  if (!useCasesConfig.size) throw new Error('No matching use case');

  const coreConfig = {};
  await createCoreResources(coreConfig);
  const testVariantsConfig = resolveTestVariantsConfig(useCasesConfig, { multiplyBy: 5 });
  for (const testConfig of testVariantsConfig) {
    testConfig.deferredResult = processFunction(testConfig, coreConfig).catch((error) => ({
      // As we process result promises sequentially step by step in next turn, allowing them to
      // reject will generate unhandled rejection.
      // Therefore this scenario is converted to successuful { error } resolution
      error,
    }));
  }

  try {
    const resultsMap = new Map();
    for (const testConfig of testVariantsConfig) {
      const testResult = await testConfig.deferredResult;
      if (testResult.error) throw testResult.error;
      const basename = testConfig.name.slice(0, -2);
      const separatorIndex = basename.lastIndexOf('-');
      const functionVariantName = basename.slice(0, separatorIndex);
      const benchmarkVariantName = basename.slice(separatorIndex + 1);
      if (!resultsMap.has(functionVariantName)) resultsMap.set(functionVariantName, new Map());
      const functionVariantResultsMap = resultsMap.get(functionVariantName);
      if (!functionVariantResultsMap.has(benchmarkVariantName)) {
        functionVariantResultsMap.set(benchmarkVariantName, { reports: [] });
      }
      functionVariantResultsMap.get(benchmarkVariantName).reports.push(testResult);
    }

    for (const [functionVariantName, functionVariantResultsMap] of resultsMap) {
      for (const [benchmarkVariantName, benchmarkVariantResult] of functionVariantResultsMap) {
        const { reports } = benchmarkVariantResult;

        const durationsData = {
          initialization: {
            external: reports.map(
              ({
                processesData: [
                  {
                    extensionOverheadDurations: { externalInit },
                  },
                ],
              }) => externalInit || 0
            ),
            internal: reports.map(
              ({
                processesData: [
                  {
                    extensionOverheadDurations: { internalInit },
                  },
                ],
              }) => internalInit || 0
            ),
            total: reports.map(({ processesData: [{ initDuration }] }) => initDuration),
          },
          invocation: {
            first: {
              internal: {
                request: reports.map(
                  ({
                    invocationsData: [
                      {
                        extensionOverheadDurations: { internalRequest },
                      },
                    ],
                  }) => internalRequest || 0
                ),
                response: reports.map(
                  ({
                    invocationsData: [
                      {
                        extensionOverheadDurations: { internalResponse },
                      },
                    ],
                  }) => internalResponse || 0
                ),
              },
              external: reports.map(
                ({
                  invocationsData: [
                    {
                      extensionOverheadDurations: { externalResponse },
                    },
                  ],
                }) => externalResponse || 0
              ),
              total: reports.map(({ invocationsData: [{ duration }] }) => duration),
              billed: reports.map(({ invocationsData: [{ billedDuration }] }) => billedDuration),
              local: reports.map(({ invocationsData: [{ localDuration }] }) => localDuration),
              maxMemoryUsed: reports.map(
                ({ invocationsData: [{ maxMemoryUsed }] }) => maxMemoryUsed
              ),
            },
            following: {
              internal: {
                request: reports.map(
                  ({
                    invocationsData: [
                      ,
                      {
                        extensionOverheadDurations: { internalRequest },
                      },
                    ],
                  }) => internalRequest || 0
                ),
                response: reports.map(
                  ({
                    invocationsData: [
                      ,
                      {
                        extensionOverheadDurations: { internalResponse },
                      },
                    ],
                  }) => internalResponse || 0
                ),
              },
              external: reports.map(
                ({
                  invocationsData: [
                    ,
                    {
                      extensionOverheadDurations: { externalResponse },
                    },
                  ],
                }) => externalResponse || 0
              ),
              total: reports.map(({ invocationsData: [, { duration }] }) => duration),
              billed: reports.map(({ invocationsData: [, { billedDuration }] }) => billedDuration),
              local: reports.map(({ invocationsData: [, { localDuration }] }) => localDuration),
              maxMemoryUsed: reports.map(
                ({ invocationsData: [, { maxMemoryUsed }] }) => maxMemoryUsed
              ),
            },
          },
        };

        benchmarkVariantResult.results = {
          initialization: {
            external: {
              average: average(durationsData.initialization.external),
              median: median(durationsData.initialization.external),
            },
            internal: {
              average: average(durationsData.initialization.internal),
              median: median(durationsData.initialization.internal),
            },
            total: {
              average: average(durationsData.initialization.total),
              median: median(durationsData.initialization.total),
            },
          },
          invocation: {
            first: {
              internal: {
                request: {
                  average: average(durationsData.invocation.first.internal.request),
                  median: median(durationsData.invocation.first.internal.request),
                },
                response: {
                  average: average(durationsData.invocation.first.internal.response),
                  median: median(durationsData.invocation.first.internal.response),
                },
              },
              external: {
                average: average(durationsData.invocation.first.external),
                median: median(durationsData.invocation.first.external),
              },
              total: {
                average: average(durationsData.invocation.first.total),
                median: median(durationsData.invocation.first.total),
              },
              billed: {
                average: average(durationsData.invocation.first.billed),
                median: median(durationsData.invocation.first.billed),
              },
              local: {
                average: average(durationsData.invocation.first.local),
                median: median(durationsData.invocation.first.local),
              },
              maxMemoryUsed: {
                average: average(durationsData.invocation.first.maxMemoryUsed),
                median: median(durationsData.invocation.first.maxMemoryUsed),
              },
            },
            following: {
              internal: {
                request: {
                  average: average(durationsData.invocation.following.internal.request),
                  median: median(durationsData.invocation.following.internal.request),
                },
                response: {
                  average: average(durationsData.invocation.following.internal.response),
                  median: median(durationsData.invocation.following.internal.response),
                },
              },
              external: {
                average: average(durationsData.invocation.following.external),
                median: median(durationsData.invocation.following.external),
              },
              total: {
                average: average(durationsData.invocation.following.total),
                median: median(durationsData.invocation.following.total),
              },
              billed: {
                average: average(durationsData.invocation.following.billed),
                median: median(durationsData.invocation.following.billed),
              },
              local: {
                average: average(durationsData.invocation.following.local),
                median: median(durationsData.invocation.following.local),
              },
              maxMemoryUsed: {
                average: average(durationsData.invocation.following.maxMemoryUsed),
                median: median(durationsData.invocation.following.maxMemoryUsed),
              },
            },
          },
        };
        log.info(
          'Results for %s: $o',
          `${functionVariantName}-${benchmarkVariantName}`,
          benchmarkVariantResult.results
        );
      }
    }

    return resultsMap;
  } finally {
    await cleanup({ skipFunctionsCleanup: true });
  }
};
