'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const cleanup = require('../lib/cleanup');
const createCoreResources = require('../lib/create-core-resources');
const processFunction = require('../lib/process-function');
const resolveTestVariantsConfig = require('../lib/resolve-test-variants-config');
const pkgJson = require('../../package');

for (const name of ['TEST_INTERNAL_LAYER_FILENAME']) {
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
      'esm-callback/index',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'esm-thenable/index',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'callback',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'esbuild-from-esm-callback',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'thenable',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'callback-error',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
        config: { expectedOutcome: 'error:handled' },
      },
    ],
    [
      'thenable-error',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
        config: { expectedOutcome: 'error:handled' },
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
        if (expectedOutcome === 'success') {
          for (const { responsePayload } of invocationsData) {
            expect(responsePayload.raw).to.equal('"ok"');
          }
        }
        for (const [index, trace] of invocationsData.map((data) => data.trace).entries()) {
          const awsLambdaSpan = trace.spans[0];
          if (index === 0) {
            expect(trace.spans.map(({ name }) => name)).to.deep.equal([
              'aws.lambda',
              'aws.lambda.initialization',
              'aws.lambda.invocation',
            ]);
            expect(awsLambdaSpan.tags['aws.lambda.is_coldstart']).to.be.true;
          } else {
            expect(trace.spans.map(({ name }) => name)).to.deep.equal([
              'aws.lambda',
              'aws.lambda.invocation',
            ]);
            expect(awsLambdaSpan.tags).to.not.have.property('aws.lambda.is_coldstart');
          }
          expect(trace.slsTags).to.deep.equal({
            'orgId': process.env.SLS_ORG_ID,
            'service': testConfig.configuration.FunctionName,
            'sdk.name': pkgJson.name,
            'sdk.version': pkgJson.version,
          });
          expect(awsLambdaSpan.tags).to.have.property('aws.lambda.arch');
          expect(awsLambdaSpan.tags['aws.lambda.name']).to.equal(
            testConfig.configuration.FunctionName
          );
          expect(awsLambdaSpan.tags).to.have.property('aws.lambda.request_id');
          expect(awsLambdaSpan.tags).to.have.property('aws.lambda.version');
          if (expectedOutcome === 'success') {
            expect(awsLambdaSpan.tags['aws.lambda.outcome']).to.equal('success');
          } else {
            expect(awsLambdaSpan.tags['aws.lambda.outcome']).to.equal('error:handled');
            expect(awsLambdaSpan.tags).to.have.property('aws.lambda.error_exception_message');
            expect(awsLambdaSpan.tags).to.have.property('aws.lambda.error_exception_stacktrace');
          }
        }
      }
      if (testConfig.test) {
        testConfig.test({ invocationsData });
      }
    });
  }

  after(async () => cleanup({ skipFunctionsCleanup: true }));
});
