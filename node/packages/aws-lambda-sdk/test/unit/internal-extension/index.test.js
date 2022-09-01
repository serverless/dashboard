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
      protoTraceOutput:
        serverlessSdk._lastProtoTraceBuffer &&
        TracePayload.decode(serverlessSdk._lastProtoTraceBuffer),
    };
  });
  if (outcome.error && (!outcome.protoTraceOutput || options.outcome !== 'error')) {
    throw outcome.error;
  }
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

  return outcome;
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

  it('should handle API Gateway REST API event', async () => {
    const {
      trace: {
        spans: [{ tags }],
      },
    } = await handleInvocation('api-endpoint', {
      isApiEndpoint: true,
      payload: {
        resource: '/some-path/{param}',
        path: '/some-path/some-param',
        httpMethod: 'POST',
        headers: {
          'Accept': '*/*',
          'Accept-Encoding': 'gzip,deflate',
          'Other': 'Second',
        },
        multiValueHeaders: {
          'Accept': ['*/*'],
          'Accept-Encoding': ['gzip,deflate'],
          'Other': ['First', 'Second'],
        },
        queryStringParameters: { foo: 'bar', next: 'second' },
        multiValueQueryStringParameters: { foo: ['bar'], next: ['first', 'second'] },
        pathParameters: { param: 'some-param' },
        stageVariables: null,
        requestContext: {
          resourceId: 'qrj0an',
          resourcePath: '/some-path/{param}',
          httpMethod: 'POST',
          extendedRequestId: 'XruZgEKYIAMFauw=',
          requestTime: '30/Aug/2022:15:20:03 +0000',
          path: '/test/some-path/some-param',
          accountId: '205994128558',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'xxx',
          requestTimeEpoch: 1661872803090,
          requestId: 'da6c4e62-62c8-4693-8a4a-d6c4d943ddb4',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '80.55.87.22',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
            user: null,
          },
          domainName: 'xxx.execute-api.us-east-1.amazonaws.com',
          apiId: 'xxx',
        },
        body: '"ok"',
        isBase64Encoded: false,
      },
    });

    expect(tags.get('aws.lambda.api_gateway.account_id')).to.equal('205994128558');
    expect(tags.get('aws.lambda.api_gateway.api_id')).to.equal('xxx');
    expect(tags.get('aws.lambda.api_gateway.api_stage')).to.equal('test');

    expect(tags.get('aws.lambda.api_gateway.request.id')).to.equal(
      'da6c4e62-62c8-4693-8a4a-d6c4d943ddb4'
    );
    expect(tags.get('aws.lambda.api_gateway.request.time_epoch')).to.equal(1661872803090);
    expect(tags.get('aws.lambda.api_gateway.request.protocol')).to.equal('HTTP/1.1');
    expect(tags.get('aws.lambda.api_gateway.request.domain')).to.equal(
      'xxx.execute-api.us-east-1.amazonaws.com'
    );
    expect(tags.get('aws.lambda.api_gateway.request.headers')).to.equal(
      JSON.stringify({
        'Accept': '*/*',
        'Accept-Encoding': 'gzip,deflate',
        'Other': ['First', 'Second'],
      })
    );
    expect(tags.get('aws.lambda.api_gateway.request.method')).to.equal('POST');
    expect(tags.get('aws.lambda.api_gateway.request.path')).to.equal('/test/some-path/some-param');
    expect(tags.get('aws.lambda.api_gateway.request.path_parameters')).to.equal(
      JSON.stringify({ param: 'some-param' })
    );
    expect(tags.get('aws.lambda.api_gateway.request.query_string_parameters')).to.equal(
      JSON.stringify({
        foo: 'bar',
        next: ['first', 'second'],
      })
    );
  });

  it('should handle API Gateway v2 HTTP API, payload v1 event', async () => {
    const {
      trace: {
        spans: [{ tags }],
      },
    } = await handleInvocation('api-endpoint', {
      isApiEndpoint: true,
      payload: {
        version: '1.0',
        resource: '/v1',
        path: '/v1',
        httpMethod: 'POST',
        headers: {
          'Content-Length': '385',
          'Content-Type':
            'multipart/form-data; boundary=--------------------------182902192059219621976732',
          'Multi': 'two',
        },
        multiValueHeaders: {
          'Content-Length': ['385'],
          'Content-Type': [
            'multipart/form-data; boundary=--------------------------182902192059219621976732',
          ],
          'Multi': ['one,stillone', 'two'],
        },
        queryStringParameters: {
          lone: 'value',
          multi: 'two',
        },
        multiValueQueryStringParameters: {
          lone: ['value'],
          multi: ['one,stillone', 'two'],
        },
        requestContext: {
          accountId: '205994128558',
          apiId: 'xxx',
          domainName: 'xxx.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'xxx',
          extendedRequestId: 'XyGqvi5mIAMEJtw=',
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            caller: null,
            cognitoAmr: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            sourceIp: '80.55.87.22',
            user: null,
            userAgent: 'PostmanRuntime/7.29.0',
            userArn: null,
          },
          path: '/v1',
          protocol: 'HTTP/1.1',
          requestId: 'XyGqvi5mIAMEJtw=',
          requestTime: '01/Sep/2022:13:47:10 +0000',
          requestTimeEpoch: 1662040030156,
          resourceId: 'POST /v1',
          resourcePath: '/v1',
          stage: '$default',
        },
        pathParameters: null,
        stageVariables: null,
        body: 'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTE4MjkwMjE5MjA1OTIxOTYyMTk3NjczMg0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0xODI5MDIxOTIwNTkyMTk2MjE5NzY3MzINCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTE4MjkwMjE5MjA1OTIxOTYyMTk3NjczMg0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tMTgyOTAyMTkyMDU5MjE5NjIxOTc2NzMyLS0NCg==',
        isBase64Encoded: true,
      },
    });

    expect(tags.get('aws.lambda.api_gateway.account_id')).to.equal('205994128558');
    expect(tags.get('aws.lambda.api_gateway.api_id')).to.equal('xxx');
    expect(tags.get('aws.lambda.api_gateway.api_stage')).to.equal('$default');

    expect(tags.get('aws.lambda.api_gateway.request.id')).to.equal('XyGqvi5mIAMEJtw=');
    expect(tags.get('aws.lambda.api_gateway.request.time_epoch')).to.equal(1662040030156);
    expect(tags.get('aws.lambda.api_gateway.request.protocol')).to.equal('HTTP/1.1');
    expect(tags.get('aws.lambda.api_gateway.request.domain')).to.equal(
      'xxx.execute-api.us-east-1.amazonaws.com'
    );
    expect(tags.get('aws.lambda.api_gateway.request.headers')).to.equal(
      JSON.stringify({
        'Content-Length': '385',
        'Content-Type':
          'multipart/form-data; boundary=--------------------------182902192059219621976732',
        'Multi': ['one,stillone', 'two'],
      })
    );
    expect(tags.get('aws.lambda.api_gateway.request.method')).to.equal('POST');
    expect(tags.get('aws.lambda.api_gateway.request.path')).to.equal('/v1');
    expect(tags.get('aws.lambda.api_gateway.request.query_string_parameters')).to.equal(
      JSON.stringify({
        lone: 'value',
        multi: ['one,stillone', 'two'],
      })
    );
  });
});
