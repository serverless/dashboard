'use strict';

const { expect } = require('chai');
const path = require('path');
const isThenable = require('type/thenable/is');
const requireUncached = require('ncjsm/require-uncached');

const fixturesDirname = path.resolve(__dirname, '../../fixtures');

const handleSuccess = async (handlerModuleName, payload = {}) => {
  process.env._HANDLER = `${handlerModuleName}.handler`;
  const functionName = handlerModuleName.includes(path.sep)
    ? path.dirname(handlerModuleName)
    : handlerModuleName;
  process.env.AWS_LAMBDA_FUNCTION_NAME = functionName;

  const result = await requireUncached(async () => {
    await require('../../../internal-extension');
    const handlerModule = await require('../../../internal-extension/wrapper');
    const response = await new Promise((resolve, reject) => {
      const maybeThenable = handlerModule.handler(
        payload,
        {
          awsRequestId: '123',
          functionName,
          invokedFunctionArn: `arn:aws:lambda:us-east-1:123456789012:function:${functionName}`,
          getRemainingTimeInMillis: () => 3000,
        },
        (error, value) => {
          if (error) reject(error);
          else resolve(value);
        }
      );
      if (isThenable(maybeThenable)) resolve(maybeThenable);
    });
    return { response, trace: require('../../../')._lastTrace };
  });
  const [awsLambdaSpan] = result.trace.spans;
  expect(result.trace.slsTags).to.deep.equal({
    orgId: process.env.SLS_ORG_ID,
    service: functionName,
  });
  expect(awsLambdaSpan.tags.get('aws.lambda.is_coldstart')).to.be.true;
  expect(awsLambdaSpan.tags.get('aws.lambda.name')).to.equal(functionName);
  expect(awsLambdaSpan.tags.get('aws.lambda.request_id')).to.equal('123');
  expect(result.response).to.equal('ok');
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

  it('should handle "ESM callback"', async () => handleSuccess('esm-callback/index'));
  it('should handle "ESM thenable"', async () => handleSuccess('esm-thenable/index'));
  it('should handle "callback"', async () => handleSuccess('callback'));
  it('should handle "thenable"', async () => handleSuccess('thenable'));
  it('should handle "esbuild from ESM callback', async () =>
    handleSuccess('esbuild-from-esm-callback'));
});
