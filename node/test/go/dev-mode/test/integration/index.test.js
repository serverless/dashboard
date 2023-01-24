'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const { DevModePayload } = require('@serverless/sdk-schema/dist/dev_mode');
const { LogPayload } = require('@serverless/sdk-schema/dist/log');
const cleanup = require('../lib/cleanup');
const createCoreResources = require('../lib/create-core-resources');
const basename = require('../lib/basename');
const getProcessFunction = require('../../../../lib/get-process-function');
const resolveTestVariantsConfig = require('../../../../lib/resolve-test-variants-config');
const resolveDirZipBuffer = require('../../../../utils/resolve-dir-zip-buffer');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

for (const name of ['TEST_EXTERNAL_LAYER_FILENAME']) {
  // In tests, current working directory is mocked,
  // so if relative path is provided in env var it won't be resolved properly
  // with this patch we resolve it before cwd mocking
  if (process.env[name]) process.env[name] = path.resolve(process.env[name]);
}

describe('Integration', function () {
  this.timeout(120000);
  const coreConfig = {};

  const internalConfiguration = {
    configuration: {
      Environment: {
        Variables: {
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
          SLS_ORG_ID: process.env.SLS_ORG_ID,
          SERVERLESS_PLATFORM_STAGE: 'dev',
          SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
          SLS_TEST_EXTENSION_LOG: '1',
        },
      },
    },
    deferredConfiguration: () => ({
      Layers: [coreConfig.layerExternalArn, coreConfig.layerInternalArn],
    }),
  };

  const useCasesConfig = new Map([
    [
      '4s-logger',
      {
        variants: new Map([
          ['v16', { configuration: { Runtime: 'nodejs16.x', Timeout: 5 } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x', Timeout: 5 } }],
        ]),
        config: {
          test: ({ invocationsData, testConfig }) => {
            for (const { logPayloads } of invocationsData) {
              expect(logPayloads.length).to.equal(8);
              const logPayload = logPayloads[0];
              expect(logPayload.slsTags.service).to.equal(testConfig.configuration.FunctionName);
              logPayload.logEvents.forEach((logItem, index) => {
                const body = logItem.body || '';
                expect(
                  `${testConfig.name.replace('-v18', '').replace('-v16', '')} ${index + 1}`
                ).to.have.string(body.slice(body.lastIndexOf('\t') + 1).replace('\n', ''));
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
          [
            'v16',
            {
              ...internalConfiguration,
              configuration: {
                ...internalConfiguration.configuration,
                Runtime: 'nodejs16.x',
                Timeout: 5,
              },
            },
          ],
          [
            'v18',
            {
              ...internalConfiguration,
              configuration: { ...internalConfiguration.configuration, Timeout: 5 },
            },
          ],
        ]),
        config: {
          test: ({ invocationsData, testConfig }) => {
            // Ensure that the logs are coming through
            for (const { logPayloads } of invocationsData) {
              expect(logPayloads.length).to.equal(1);
              const logPayload = logPayloads[0];
              expect(logPayload.slsTags.service).to.equal(testConfig.configuration.FunctionName);
              logPayload.logEvents.forEach((logItem, index) => {
                const body = logItem.body || '';
                const traceId = logItem.traceId || '';
                expect(traceId).to.not.be.empty;
                expect(
                  `${testConfig.name.replace('-v18', '').replace('-v16', '')} ${index + 1}`
                ).to.have.string(body.slice(body.lastIndexOf('\t') + 1).replace('\n', ''));
              });
            }

            // Replace with external + sdk integration results once the sdk is configured
            // to communicate with the external extension
            for (const {
              printedPayloads: { DR: reqRes },
            } of invocationsData) {
              expect(reqRes.length).to.equal(2);
            }

            for (const { devModePayloads } of invocationsData) {
              // Since we are sending spans as they are complete I need to change this to a variable length
              // but we should always have at least 1
              expect(devModePayloads.length >= 1).to.equal(true);
              const devModePayload = devModePayloads[0];
              expect(devModePayload.payload.trace.events.length).to.equal(2);
            }
          },
        },
      },
    ],
  ]);

  const testVariantsConfig = resolveTestVariantsConfig(useCasesConfig);

  before(async () => {
    await createCoreResources(coreConfig);
    const processFunction = await getProcessFunction(basename, coreConfig, {
      TracePayload,
      LogPayload,
      DevModePayload,
      baseLambdaConfiguration: {
        Role: coreConfig.roleArn,
        Runtime: 'nodejs18.x',
        MemorySize: 1024,
        Code: {
          ZipFile: await resolveDirZipBuffer(fixturesDirname),
        },
        Layers: [coreConfig.layerExternalArn],
        Environment: {
          Variables: {
            SERVERLESS_PLATFORM_STAGE: 'dev',
            SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
            SLS_TEST_EXTENSION_LOG: '1',
          },
        },
      },
    });
    for (const testConfig of testVariantsConfig) {
      testConfig.deferredResult = processFunction(testConfig).catch((error) => ({
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
