'use strict';

const { expect } = require('chai');

const fsp = require('fs').promises;
const path = require('path');
const log = require('log').get('test');
const toml = require('toml');
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const cleanup = require('./lib/cleanup');
const createCoreResources = require('./lib/create-core-resources');
const basename = require('./lib/basename');
const getProcessFunction = require('../../lib/get-process-function');
const resolveOutcomeEnumValue = require('../../utils/resolve-outcome-enum-value');
const resolveNanosecondsTimestamp = require('../../utils/resolve-nanoseconds-timestamp');
const normalizeEvents = require('../../utils/normalize-events');
const resolveTestVariantsConfig = require('../../lib/resolve-test-variants-config');

const fixturesDirname = path.resolve(
  __dirname,
  '../../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas'
);

for (const name of ['TEST_EXTERNAL_LAYER_FILENAME']) {
  // In tests, current working directory is mocked,
  // so if relative path is provided in env var it won't be resolved properly
  // with this patch we resolve it before cwd mocking
  if (process.env[name]) process.env[name] = path.resolve(process.env[name]);
}

describe('Python: integration', function () {
  this.timeout(120000);
  const coreConfig = {};

  const sdkTestConfig = {
    isCustomResponse: true,
    test: ({ invocationsData }) => {
      for (const [index, { trace, responsePayload }] of invocationsData.entries()) {
        const { spans } = trace;
        if (index === 0) {
          expect(spans.map(({ name }) => name)).to.deep.equal([
            'aws.lambda',
            'aws.lambda.initialization',
            'aws.lambda.invocation',
            'user.span',
          ]);
        } else {
          expect(spans.map(({ name }) => name)).to.deep.equal([
            'aws.lambda',
            'aws.lambda.invocation',
            'user.span',
          ]);
        }
        const payload = JSON.parse(responsePayload.raw);
        expect(payload.name).to.equal(pyProjectToml.project.name);
        expect(payload.version).to.equal(pyProjectToml.project.version);
        expect(payload.rootSpanName).to.equal('aws.lambda');
      }
    },
  };

  const useCasesConfig = new Map([
    [
      'success',
      {
        variants: new Map([
          ['v3-8', { configuration: { Runtime: 'python3.8' } }],
          ['v3-9', { configuration: { Runtime: 'python3.9' } }],
        ]),
      },
    ],
    [
      'error',
      {
        variants: new Map([
          ['v3-8', { configuration: { Runtime: 'python3.8' } }],
          ['v3-9', { configuration: { Runtime: 'python3.9' } }],
        ]),
        config: { expectedOutcome: 'error:handled' },
      },
    ],
    [
      'sdk',
      {
        variants: new Map([
          ['v3-8', { configuration: { Runtime: 'python3.8' } }],
          ['v3-9', { configuration: { Runtime: 'python3.9' } }],
        ]),
        config: sdkTestConfig,
      },
    ],
  ]);

  const testVariantsConfig = resolveTestVariantsConfig(useCasesConfig);

  let pyProjectToml;
  let beforeTimestamp;

  before(async () => {
    pyProjectToml = toml.parse(
      await fsp.readFile(
        path.resolve(__dirname, '../../../../python/packages/aws-lambda-sdk/pyproject.toml'),
        'utf8'
      )
    );
    await createCoreResources(coreConfig);

    const processFunction = await getProcessFunction(basename, coreConfig, {
      TracePayload,
      fixturesDirname,
      baseLambdaConfiguration: {
        Runtime: 'python3.9',
        Layers: [coreConfig.layerInternalArn],
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-python/exec_wrapper.py',
          },
        },
      },
    });

    beforeTimestamp = resolveNanosecondsTimestamp() - 2000000000; // 2 seconds ago

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
    // eslint-disable-next-line no-loop-func
    it(testConfig.name, async () => {
      const testResult = await testConfig.deferredResult;
      if (testResult.error) throw testResult.error;
      log.debug('%s test result: %o', testConfig.name, testResult);
      const afterTimestamp = resolveNanosecondsTimestamp() + 2000000000; // 2 seconds after
      const { expectedOutcome, capturedEvents } = testConfig;
      const { invocationsData } = testResult;
      if (
        expectedOutcome === 'success' ||
        expectedOutcome === 'error:handled' ||
        expectedOutcome === 'error:unhandled'
      ) {
        if (
          expectedOutcome === 'success' &&
          !testConfig.isAsyncInvocation &&
          !testConfig.isCustomResponse
        ) {
          for (const { responsePayload } of invocationsData) {
            expect(responsePayload.raw).to.equal('"ok"');
          }
        }
        for (const [index, { trace }] of invocationsData.entries()) {
          if (!trace) throw new Error('Missing trace payload');
          const { spans, slsTags, events } = trace;
          const lambdaSpan = spans[0];
          if (index === 0 || expectedOutcome === 'error:unhandled') {
            expect(spans.map(({ name }) => name).slice(0, 3)).to.deep.equal([
              'aws.lambda',
              'aws.lambda.initialization',
              'aws.lambda.invocation',
            ]);
            expect(lambdaSpan.tags.aws.lambda.isColdstart).to.be.true;
            const [, initializationSpan, invocationSpan] = spans;
            expect(String(initializationSpan.parentSpanId)).to.equal(String(lambdaSpan.id));
            expect(String(invocationSpan.parentSpanId)).to.equal(String(lambdaSpan.id));
            expect(lambdaSpan.startTimeUnixNano).to.equal(initializationSpan.startTimeUnixNano);
            expect(lambdaSpan.endTimeUnixNano).to.equal(invocationSpan.endTimeUnixNano);
            if (initializationSpan.endTimeUnixNano > invocationSpan.startTimeUnixNano) {
              throw new Error('Initialization span overlaps invocation span');
            }
          } else {
            if (!testConfig.hasOrphanedSpans) {
              expect(spans.map(({ name }) => name).slice(0, 2)).to.deep.equal([
                'aws.lambda',
                'aws.lambda.invocation',
              ]);
              const [, invocationSpan] = spans;
              expect(lambdaSpan.startTimeUnixNano).to.equal(invocationSpan.startTimeUnixNano);
              expect(lambdaSpan.endTimeUnixNano).to.equal(invocationSpan.endTimeUnixNano);
            }
            expect(lambdaSpan.tags.aws.lambda.isColdstart).to.be.false;
            const [, invocationSpan] = spans;
            expect(String(invocationSpan.parentSpanId)).to.equal(String(lambdaSpan.id));
          }
          for (const span of spans) {
            if (span.endTimeUnixNano <= span.startTimeUnixNano) {
              throw new Error(
                `Span ${span.name} has invalid time range: ` +
                  `${span.startTimeUnixNano} - ${span.endTimeUnixNano}`
              );
            }
            if (span.startTimeUnixNano < beforeTimestamp) {
              throw new Error(
                `Span ${span.name} has invalid start time: ${span.startTimeUnixNano}`
              );
            }
            if (span.endTimeUnixNano > afterTimestamp) {
              throw new Error(`Span ${span.name} has invalid end time: ${span.endTimeUnixNano}`);
            }
            if (!testConfig.hasOrphanedSpans) {
              if (span.startTimeUnixNano < lambdaSpan.startTimeUnixNano) {
                throw new Error(
                  `Span ${span.name} start time is earlier than start time of ` +
                    `root span: ${span.startTimeUnixNano}`
                );
              }
              if (span.endTimeUnixNano > lambdaSpan.endTimeUnixNano) {
                throw new Error(
                  `Span ${span.name} end time is past end time of ` +
                    `root span: ${span.startTimeUnixNano}`
                );
              }
            }
          }
          expect(slsTags).to.deep.equal({
            orgId: process.env.SLS_ORG_ID,
            service: testConfig.configuration.FunctionName,
            sdk: { name: pyProjectToml.project.name, version: pyProjectToml.project.version },
          });
          expect(lambdaSpan.tags.aws.lambda).to.have.property('arch');
          expect(lambdaSpan.tags.aws.lambda.name).to.equal(testConfig.configuration.FunctionName);
          expect(lambdaSpan.tags.aws.lambda).to.have.property('requestId');
          expect(lambdaSpan.tags.aws.lambda).to.have.property('version');
          expect(lambdaSpan.tags.aws.lambda.outcome).to.equal(
            resolveOutcomeEnumValue(expectedOutcome)
          );
          const normalizedEvents = normalizeEvents(events);
          if (!capturedEvents) expect(normalizedEvents).deep.equal([]);
          else expect(normalizedEvents).deep.equal(capturedEvents);
        }
      }

      if (testConfig.test) {
        testConfig.test({ invocationsData, testConfig });
      }
    });
  }

  after(async () => cleanup({ mode: 'core' }));
});
