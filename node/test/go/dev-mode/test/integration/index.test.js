'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const logProto = require('@serverless/sdk-schema/dist/log');
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

describe('Integration', function () {
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
              expect(logs.length).to.equal(8);
              const logData = Buffer.from(logs[0].payload, 'base64');
              const logPayload = logProto.LogPayload.decode(logData);
              expect(logPayload.slsTags.service).to.equal(testConfig.configuration.FunctionName);
              logPayload.logEvents.forEach((logItem, index) => {
                const message = logItem.message || '';
                expect(
                  `${testConfig.name.replace('-v14', '').replace('-v16', '')} ${index + 1}`
                ).to.have.string(message.slice(message.lastIndexOf('\t') + 1).replace('\n', ''));
              });
            }
          },
        },
      },
    ],
    [
      'with-internal',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x', Timeout: 10 }, includeInternal: true }],
          ['v16', { configuration: { Runtime: 'nodejs16.x', Timeout: 10 }, includeInternal: true }],
        ]),
        config: {
          test: ({ invocationsData }) => {
            // Replace with external + sdk integration results once the sdk is configured
            // to communicate with the external extension
            const allReqResData = invocationsData.map((data) => data.reqRes);
            expect(allReqResData[0].length).to.equal(0);
            expect(allReqResData[1].length).to.equal(0);

            // for (const [, reqRes] of invocationsData.map((data) => data.reqRes).entries()) {
            //   expect(reqRes.length).to.equal(1);
            //   for (const payload of reqRes) {
            //     expect(payload).to.haveOwnProperty('region');
            //     expect(payload).to.haveOwnProperty('accountId');
            //     expect(payload).to.haveOwnProperty('timestamps');
            //     expect(payload).to.haveOwnProperty('payloads');
            //   }
            // }
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

      if (testConfig.test) {
        testConfig.test({ invocationsData, testConfig });
      }
    });
  }

  after(async () => cleanup({ mode: 'core' }));
});
