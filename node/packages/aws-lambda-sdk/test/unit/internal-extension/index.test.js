'use strict';

const { expect } = require('chai');
const path = require('path');
const isThenable = require('type/thenable/is');
const requireUncached = require('ncjsm/require-uncached');
const pkgJson = require('../../../package');

const fixturesDirname = path.resolve(__dirname, '../../fixtures');

const normalizeObject = (obj) => {
  const entries = Array.isArray(obj) ? obj.entries() : Object.entries(obj);
  for (const [key, value] of entries) {
    if (value == null) delete obj[key];
    else if (Array.isArray(value)) normalizeObject(value);
    else if (typeof value === 'object') normalizeObject(value);
  }
  return obj;
};

const handleInvocation = async (handlerModuleName, options = {}) => {
  process.env._HANDLER = `${handlerModuleName}.handler`;
  const functionName = handlerModuleName.includes(path.sep)
    ? path.dirname(handlerModuleName)
    : handlerModuleName;
  process.env.AWS_LAMBDA_FUNCTION_NAME = functionName;

  const outcome = await requireUncached(async () => {
    await require('../../../internal-extension');
    const handlerModule = await require('../../../internal-extension/wrapper');
    let result;
    let error;
    try {
      result = await new Promise((resolve, reject) => {
        const maybeThenable = handlerModule.handler(
          options.payload || {},
          {
            awsRequestId: '123',
            functionName,
            invokedFunctionArn: `arn:aws:lambda:us-east-1:123456789012:function:${functionName}`,
            getRemainingTimeInMillis: () => 3000,
          },
          (invocationError, value) => {
            if (invocationError) reject(invocationError);
            else resolve(value);
          }
        );
        if (isThenable(maybeThenable)) resolve(maybeThenable);
      });
    } catch (invocationError) {
      error = invocationError;
    }
    const serverlessSdk = require('../../../');
    const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
    return {
      result,
      error,
      trace: serverlessSdk._lastTrace,
      protoTraceInput: serverlessSdk._lastProtoTrace,
      protoTraceOutput: TracePayload.decode(serverlessSdk._lastProtoTraceBuffer),
    };
  });
  if (!outcome.trace && outcome.error) throw outcome.error;
  const [{ tags }] = outcome.trace.spans;
  expect(outcome.trace.slsTags).to.deep.equal({
    'orgId': process.env.SLS_ORG_ID,
    'service': functionName,
    'sdk.name': pkgJson.name,
    'sdk.version': pkgJson.version,
  });
  expect(tags.get('aws.lambda.is_coldstart')).to.be.true;
  expect(tags.get('aws.lambda.name')).to.equal(functionName);
  expect(tags.get('aws.lambda.request_id')).to.equal('123');
  expect(tags.get('aws.lambda.version')).to.equal('$LATEST');

  if (options.outcome === 'error') {
    expect(tags.get('aws.lambda.outcome')).to.equal('error:handled');
    expect(typeof tags.get('aws.lambda.error_exception_message')).to.equal('string');
    expect(typeof tags.get('aws.lambda.error_exception_stacktrace')).to.equal('string');
  } else {
    if (outcome.error) throw outcome.error;
    if (options.isApiEndpoint) expect(JSON.parse(outcome.result.body)).to.equal('ok');
    else expect(outcome.result).to.equal('ok');

    expect(tags.get('aws.lambda.outcome')).to.equal('success');
  }

  const input = normalizeObject(outcome.protoTraceInput);
  const output = normalizeObject(outcome.protoTraceOutput);

  expect(output.spans[0]).to.deep.equal(input.spans[0]);
};

describe('internal-extension/index.test.js', () => {
  before(() => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    process.env.AWS_LAMBDA_INITIALIZATION_TYPE = 'on-demand';
    process.env.AWS_REGION = 'us-east-1';
    process.env.LAMBDA_TASK_ROOT = path.resolve(fixturesDirname, 'lambdas');
    process.env.LAMBDA_RUNTIME_DIR = path.resolve(fixturesDirname, 'runtime');
    process.env.SLS_ORG_ID = 'dummy';
  });
  afterEach(() => {
    delete process.env._HANDLER;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  it('should handle "ESM callback"', async () => handleInvocation('esm-callback/index'));
  it('should handle "ESM thenable"', async () => handleInvocation('esm-thenable/index'));
  it('should handle "callback"', async () => handleInvocation('callback'));
  it('should handle "thenable"', async () => handleInvocation('thenable'));
  it('should handle "esbuild from ESM callback', async () =>
    handleInvocation('esbuild-from-esm-callback'));
  it('should handle "callback error"', async () =>
    handleInvocation('callback-error', { outcome: 'error' }));
  it('should handle "thenable error"', async () =>
    handleInvocation('thenable-error', { outcome: 'error' }));
});
