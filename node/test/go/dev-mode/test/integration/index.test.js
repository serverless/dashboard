'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const cleanup = require('../lib/cleanup');
const createCoreResources = require('../lib/create-core-resources');
const processFunction = require('../lib/process-function');
const resolveTestVariantsConfig = require('../lib/resolve-test-variants-config');

for (const name of ['TEST_EXTERNAL_LAYER_FILENAME']) {
  // In tests, current working directory is mocked,
  // so if relative path is provided in env var it won't be resolved properly
  // with this patch we resolve it before cwd mocking
  if (process.env[name]) process.env[name] = path.resolve(process.env[name]);
}

describe('integration', function () {
  this.timeout(120000);
  const coreConfig = {};

  const useCasesConfig = new Map([
    [
      '4s-logger',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x', Timeout: 5 } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x', Timeout: 5 } }],
        ]),
        config: {
          test: ({ invocationsData, testConfig }) => {
            for (const [, logs] of invocationsData.map((data) => data.logs).entries()) {
              const logPayload = logs[0];
              expect(logs.length).to.equal(8);
              expect(logPayload.name).to.equal(testConfig.configuration.FunctionName);
              logs.forEach((logItem, index) => {
                const message = (logItem.messages || [{ message: '' }])[0].message;
                expect(
                  `${testConfig.name.replace('-v14', '').replace('-v16', '')} ${index + 1}`
                ).to.have.string(message.slice(message.lastIndexOf('\t') + 1).replace('\n', ''));
              });
            }
          },
        },
      },
    ],
  ]);

  const testVariantsConfig = resolveTestVariantsConfig(useCasesConfig);

  before(async () => {
    await createCoreResources(coreConfig);
    for (const testConfig of testVariantsConfig) {
      testConfig.deferredResult = processFunction(testConfig, coreConfig).catch((error) => ({
        // As we process result promises sequentially step by step in next turn, allowing them to
        // reject will generate unhandled rejection.
        // Therefore this scenario is converted to successuful { error } resolution
        error,
      }));
    }
  });

  for (const testConfig of testVariantsConfig) {
    it(testConfig.name, async () => {
      const testResult = await testConfig.deferredResult;
      if (testResult.error) throw testResult.error;
      log.debug('%s test result: %o', testConfig.name, testResult);
      const { expectedOutcome } = testConfig;
      const { invocationsData } = testResult;
      if (expectedOutcome === 'success' || expectedOutcome === 'error:handled') {
        if (expectedOutcome === 'success' && !testConfig.isAsyncInvocation) {
          for (const { responsePayload } of invocationsData) {
            expect(responsePayload.raw).to.equal('"ok"');
          }
        }
      }
    });
  }

  after(async () => cleanup({ mode: 'core' }));
});
