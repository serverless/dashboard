'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const normalizeOtelAttributes = require('../utils/normalize-otel-attributes');
const basename = require('./basename');
const cleanup = require('./cleanup');
const createCoreResources = require('./create-core-resources');
const processFunction = require('./process-function');

describe('integration', function () {
  this.timeout(120000);
  const coreConfig = {};

  const functionsConfig = new Map([
    ['success-callback', true],
    ['success-callback-esbuild-from-esm', true],
    ['success-callback-esm/index', true],
    [
      'success-callback-express',
      {
        invokeOptions: {
          payload: {
            version: '2.0',
            routeKey: '$default',
            rawPath: '/',
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
                path: '/',
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
        test: ({ instrumentationSpans }) => {
          expect(
            instrumentationSpans['@opentelemetry/instrumentation-express'].length
          ).to.be.at.least(4);
        },
      },
    ],
    [
      'error-timeout',
      {
        invokeOptions: { isFailure: true },
        // On timeout re-initialization of external extension gets slow, and we observe that second
        // invocation times out before actually lambda is initialized.
        // This is either because currently our external extension is Node.js based,
        // so has slow startup time, or it can be performance issue on AWS side.
        // To ensure reliable result increase timeout, so we get second invocation correct
        createOptions: { configuration: { Timeout: 7 } },
        test: ({ instrumentationSpans }) => {
          const { attributes } =
            instrumentationSpans['@opentelemetry/instrumentation-aws-lambda'][0];
          expect(attributes['faas.error_exception_type']).to.equal('TimeoutError');
        },
      },
    ],
  ]);

  let deferredResults;

  before(async () => {
    await createCoreResources(coreConfig);
    deferredResults = new Map(
      Array.from(functionsConfig, ([handlerModuleName, testConfig]) => [
        handlerModuleName,
        processFunction(handlerModuleName, testConfig, coreConfig).catch((error) => ({
          // As we process result promises sequentially step by step in next turn, allowing them to
          // reject will generate unhandled rejection.
          // Therefore this scenario is converted to successuful { error } resolution
          error,
        })),
      ])
    );
  });

  for (const [handlerModuleName, { invokeOptions = {}, test }] of functionsConfig) {
    const functionBasename = handlerModuleName.includes('/')
      ? path.dirname(handlerModuleName)
      : handlerModuleName;

    it(functionBasename, async () => {
      const functionResult = await deferredResults.get(handlerModuleName);
      if (functionResult.error) throw functionResult.error;
      const { reports } = functionResult;
      if (!invokeOptions.isFailure) {
        // Current timeout handling is unreliable, therefore do not attempt to confirm
        // on all reports

        // While reports should come in order as specified below,
        // there were observed cases when it wasn't the case,
        // e.g. telemetryData (response) was received before eventData (request)
        expect(
          reports.map((invocationReports) => invocationReports.map(([type]) => type).sort())
        ).to.deep.equal([
          ['request', 'response', 'metrics', 'traces'].sort(),
          ['metrics', 'request', 'response', 'metrics', 'traces'].sort(),
        ]);
      }
      const allInvocationReports = reports.flat();
      const metricsReport = allInvocationReports.find(
        ([reportType]) => reportType === 'metrics'
      )[1];

      const tracesReport = allInvocationReports.find(([reportType]) => reportType === 'traces')[1];
      const resourceMetrics = normalizeOtelAttributes(
        metricsReport.resourceMetrics[0].resource.attributes
      );
      expect(resourceMetrics['faas.name']).to.equal(`${basename}-${functionBasename}`);
      const resourceSpans = normalizeOtelAttributes(
        tracesReport.resourceSpans[0].resource.attributes
      );
      expect(resourceSpans['faas.name']).to.equal(`${basename}-${functionBasename}`);

      const instrumentationSpans = {};
      for (const {
        instrumentationLibrary: { name },
        spans,
      } of tracesReport.resourceSpans[0].instrumentationLibrarySpans) {
        instrumentationSpans[name] = spans.map((span) => ({
          ...span,
          attributes: normalizeOtelAttributes(span.attributes),
        }));
      }
      log.debug('instrumentationSpans %o', instrumentationSpans);
      if (test) {
        test({
          metricsReport,
          tracesReport,
          resourceMetrics,
          resourceSpans,
          instrumentationSpans,
        });
      }
    });
  }

  after(async () => cleanup({ skipFunctionsCleanup: true }));
});
