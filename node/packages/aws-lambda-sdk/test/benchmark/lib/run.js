'use strict';

const log = require('log').get('test');
const resolveTestVariantsConfig = require('../../lib/resolve-test-variants-config');
const processFunction = require('../../lib/process-function');
const cleanup = require('../../lib/cleanup');
const { median, average } = require('../../utils/stats');

module.exports = async (useCasesConfig, coreConfig) => {
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
    await cleanup({ mode: 'core' });
  }
};
