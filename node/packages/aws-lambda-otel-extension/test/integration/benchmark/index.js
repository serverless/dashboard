'use strict';

const _ = require('lodash');
const path = require('path');
const apiRequest = require('@serverless/utils/api-request');
const backendUrl = require('@serverless/utils/lib/auth/urls').backend;
const createCoreResources = require('../create-core-resources');
const resolveTestScenarios = require('../resolve-test-scenarios');
const processFunction = require('../process-function');
const cleanup = require('../cleanup');
const resolveFileZipBuffer = require('../../utils/resolve-file-zip-buffer');
const { median } = require('../../utils/stats');
const log = require('log').get('test');

const fixturesDirname = path.resolve(__dirname, '../../fixtures/lambdas');
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
      'external-only',
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
      'json-log',
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
      'proto-log',
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
    allBenchmarkVariantsConfig.set('proto-console', {
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

  const allFunctionVariantsConfig = new Map([
    [
      'success-callback',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'success-callback.js')),
            },
          },
        },
        cases: benchmarkVariantsConfig,
      },
    ],
    [
      'success-callback-express',
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
        cases: benchmarkVariantsConfig,
      },
    ],
    [
      'success-callback-logger',
      {
        config: {
          configuration: {
            Code: {
              ZipFile: resolveFileZipBuffer(
                path.resolve(fixturesDirname, 'success-callback-logger.js')
              ),
            },
            Timeout: 20,
          },
        },
        cases: (() =>
          new Map(
            Array.from(benchmarkVariantsConfig, ([name, caseConfig]) => {
              switch (name) {
                case 'json-log':
                case 'proto-log': {
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
                case 'proto-console': {
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

  const functionVariantsConfig = options.functionVariants
    ? new Map(
        Array.from(allFunctionVariantsConfig).filter(([name]) => options.functionVariants.has(name))
      )
    : allFunctionVariantsConfig;

  if (!functionVariantsConfig.size) throw new Error('No matching function variant');

  const coreConfig = {};
  await createCoreResources(coreConfig);
  const testScenarios = resolveTestScenarios(functionVariantsConfig, { multiplyBy: 5 });
  for (const testConfig of testScenarios) {
    testConfig.deferredResult = processFunction(testConfig, coreConfig).catch((error) => ({
      // As we process result promises sequentially step by step in next turn, allowing them to
      // reject will generate unhandled rejection.
      // Therefore this scenario is converted to successuful { error } resolution
      error,
    }));
  }

  const resultsMap = new Map();
  for (const testConfig of testScenarios) {
    const testResult = await testConfig.deferredResult;
    if (testResult.error) throw testResult.error;
    const basename = testConfig.name.slice(0, -2);
    if (!resultsMap.has(basename)) resultsMap.set(basename, []);
    resultsMap.get(basename).push(testResult);
  }
  await cleanup({ skipFunctionsCleanup: true });

  process.stdout.write(
    `${[
      [
        'name',
        'init:external',
        'init:internal',
        'init:aws',

        'first:internal:request',
        'first:internal:response',
        'first:external:response',
        'first:aws:duration',
        'first:aws:billedDuration',
        'first:local:duration',
        'first:aws:maxMemoryUsed',

        'following:internal:request',
        'following:internal:response',
        'following:external:response',
        'following:aws:duration',
        'following:aws:billedDuration',
        'following:local:duration',
        'following:aws:maxMemoryUsed',
      ]
        .map(JSON.stringify)
        .join('\t'),
      ...Array.from(resultsMap, ([name, results]) => {
        return [
          JSON.stringify(name),
          Math.round(
            median(
              results.map(
                ({
                  processesData: [
                    {
                      extensionOverheadDurations: { externalInit },
                    },
                  ],
                }) => externalInit || 0
              )
            )
          ),
          Math.round(
            median(
              results.map(
                ({
                  processesData: [
                    {
                      extensionOverheadDurations: { internalInit },
                    },
                  ],
                }) => internalInit || 0
              )
            )
          ),
          Math.round(median(results.map(({ processesData: [{ initDuration }] }) => initDuration))),

          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    {
                      extensionOverheadDurations: { internalRequest },
                    },
                  ],
                }) => internalRequest || 0
              )
            )
          ),
          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    {
                      extensionOverheadDurations: { internalResponse },
                    },
                  ],
                }) => internalResponse || 0
              )
            )
          ),
          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    {
                      extensionOverheadDurations: { externalResponse },
                    },
                  ],
                }) => externalResponse || 0
              )
            )
          ),
          Math.round(median(results.map(({ invocationsData: [{ duration }] }) => duration))),
          Math.round(
            median(results.map(({ invocationsData: [{ billedDuration }] }) => billedDuration))
          ),
          Math.round(
            median(results.map(({ invocationsData: [{ localDuration }] }) => localDuration))
          ),
          Math.round(
            median(results.map(({ invocationsData: [{ maxMemoryUsed }] }) => maxMemoryUsed))
          ),

          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    ,
                    {
                      extensionOverheadDurations: { internalRequest },
                    },
                  ],
                }) => internalRequest || 0
              )
            )
          ),
          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    ,
                    {
                      extensionOverheadDurations: { internalResponse },
                    },
                  ],
                }) => internalResponse || 0
              )
            )
          ),
          Math.round(
            median(
              results.map(
                ({
                  invocationsData: [
                    ,
                    {
                      extensionOverheadDurations: { externalResponse },
                    },
                  ],
                }) => externalResponse || 0
              )
            )
          ),
          Math.round(median(results.map(({ invocationsData: [, { duration }] }) => duration))),
          Math.round(
            median(results.map(({ invocationsData: [, { billedDuration }] }) => billedDuration))
          ),
          Math.round(
            median(results.map(({ invocationsData: [, { localDuration }] }) => localDuration))
          ),
          Math.round(
            median(results.map(({ invocationsData: [, { maxMemoryUsed }] }) => maxMemoryUsed))
          ),
        ].join('\t');
      }),
    ].join('\n')}\n`
  );
};
