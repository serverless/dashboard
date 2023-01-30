'use strict';

const { expect } = require('chai');
const path = require('path');
const http = require('http');
const isThenable = require('type/thenable/is');
const requireUncached = require('ncjsm/require-uncached');
const wait = require('timers-ext/promise/sleep');
const normalizeObject = require('../../../../../test/utils/normalize-proto-object');
const pkgJson = require('../../../package');

const fixturesDirname = path.resolve(__dirname, '../../fixtures');

const handleInvocation = async (handlerModuleName, options = {}) => {
  process.env._HANDLER = `${handlerModuleName}.handler`;
  const functionName = handlerModuleName.includes(path.sep)
    ? path.dirname(handlerModuleName)
    : handlerModuleName;
  process.env.AWS_LAMBDA_FUNCTION_NAME = functionName;

  const payload = options.payload || { test: true };
  const stringifiedPayload = JSON.stringify(payload);
  const outcome = await requireUncached(async () => {
    require('../../../internal-extension');
    const handlerModule = await require('../../../internal-extension/wrapper');
    // Ensure tick gap between handler resolution and its invocation (reflects AWS env)
    await wait();
    let result;
    let error;
    try {
      result = await new Promise((resolve, reject) => {
        const maybeThenable = handlerModule.handler(
          payload,
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
    require('@serverless/sdk/lib/instrumentation/http').uninstall();
    require('@serverless/sdk/lib/instrumentation/express').uninstall();
    require('@serverless/sdk/lib/instrumentation/node-console').uninstall();
    require('../../../lib/instrumentation/aws-sdk').uninstall();
    delete require('uni-global')('serverless/sdk/202212').serverlessSdk;
    const serverlessSdk = require('../../../');
    const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
    const { RequestResponse } = require('@serverless/sdk-schema/dist/request_response');
    return {
      result,
      error,
      request: {
        input: serverlessSdk._lastRequest,
        output:
          serverlessSdk._lastRequestBuffer &&
          RequestResponse.decode(serverlessSdk._lastRequestBuffer),
      },
      response: {
        input: serverlessSdk._lastResponse,
        output:
          serverlessSdk._lastResponseBuffer &&
          RequestResponse.decode(serverlessSdk._lastResponseBuffer),
      },
      trace: {
        input: serverlessSdk._lastTrace,
        output:
          serverlessSdk._lastTraceBuffer && TracePayload.decode(serverlessSdk._lastTraceBuffer),
      },
    };
  });
  if (outcome.error && (!outcome.trace.output || options.outcome !== 'error')) {
    throw outcome.error;
  }

  expect(normalizeObject(outcome.trace.output)).to.deep.equal(normalizeObject(outcome.trace.input));
  expect(outcome.trace.input.slsTags).to.deep.equal({
    orgId: process.env.SLS_ORG_ID,
    service: functionName,
    sdk: { name: pkgJson.name, version: pkgJson.version },
  });
  const [lambdaSpan, initializationSpan, ...otherSpans] = outcome.trace.input.spans;
  const lambdaSpanTags = lambdaSpan.tags;
  expect(lambdaSpanTags.aws.lambda.isColdstart).to.be.true;
  expect(lambdaSpanTags.aws.lambda.name).to.equal(functionName);
  expect(lambdaSpanTags.aws.lambda.requestId).to.equal('123');
  expect(lambdaSpanTags.aws.lambda.version).to.equal('$LATEST');

  if (options.outcome === 'error') {
    expect(lambdaSpanTags.aws.lambda.outcome).to.equal(5);
    const errorTags = outcome.trace.input.events.find(
      (event) => event.tags.error && event.tags.error.type === 1
    ).tags.error;
    expect(typeof errorTags.message).to.equal('string');
    expect(typeof errorTags.stacktrace).to.equal('string');
  } else {
    if (outcome.error) throw outcome.error;
    if (options.isApiEndpoint) expect(JSON.parse(outcome.result.body)).to.equal('ok');
    else if (!options.isCustomReponse) expect(outcome.result).to.equal('ok');

    expect(lambdaSpanTags.aws.lambda.outcome).to.equal(1);
  }

  expect(initializationSpan.parentSpanId).to.deep.equal(lambdaSpan.id);
  const nonRootSpanIds = new Set(outcome.trace.input.spans.slice(1).map(({ id }) => String(id)));
  for (const otherSpan of otherSpans) expect(nonRootSpanIds.has(String(otherSpan.id))).to.be.true;

  expect(normalizeObject(outcome.request.output)).to.deep.equal(
    normalizeObject(outcome.request.input)
  );
  expect(outcome.request.input.body).to.deep.equal(stringifiedPayload);

  if (outcome.response.input) {
    expect(normalizeObject(outcome.response.output)).to.deep.equal(
      normalizeObject(outcome.response.input)
    );
  }

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
    process.env.SLS_UNIT_TEST_RUN = '1';
  });
  afterEach(() => {
    delete process.env._HANDLER;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  it('should handle "ESM callback"', async () => handleInvocation('esm-callback/index'));
  it('should handle "ESM thenable"', async () => handleInvocation('esm-thenable/index'));
  it('should handle "ESM nested module"', async () =>
    handleInvocation('esm-nested/nested/within/index'));
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
        input: {
          spans: [{ tags }],
        },
      },
      response: { input: response },
    } = await handleInvocation('api-endpoint', {
      isApiEndpoint: true,
      payload: {
        resource: '/some-path/{param}',
        path: '/some-path/some.-param',
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

    expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
    expect(tags.aws.lambda.eventType).to.equal('aws.apigateway.rest');

    expect(tags.aws.lambda.apiGateway.accountId).to.equal('205994128558');
    expect(tags.aws.lambda.apiGateway.apiId).to.equal('xxx');
    expect(tags.aws.lambda.apiGateway.apiStage).to.equal('test');

    expect(tags.aws.lambda.apiGateway.request.id).to.equal('da6c4e62-62c8-4693-8a4a-d6c4d943ddb4');
    expect(tags.aws.lambda.apiGateway.request.timeEpoch.toString()).to.equal('1661872803090');
    expect(tags.aws.lambda.http.protocol).to.equal('HTTP/1.1');
    expect(tags.aws.lambda.http.host).to.equal('xxx.execute-api.us-east-1.amazonaws.com');
    expect(tags.aws.lambda.http.requestHeaderNames).to.deep.equal([
      'Accept',
      'Accept-Encoding',
      'Other',
    ]);
    expect(tags.aws.lambda.http.method).to.equal('POST');
    expect(tags.aws.lambda.http.path).to.equal('/test/some-path/some-param');
    expect(tags.aws.lambda.apiGateway.request.pathParameterNames).to.deep.equal(['param']);
    expect(tags.aws.lambda.http.queryParameterNames).to.deep.equal(['foo', 'next']);

    expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

    expect(tags.aws.lambda.httpRouter.path).to.equal('/some-path/{param}');

    expect(response.body).to.deep.equal(JSON.stringify({ statusCode: 200, body: '"ok"' }));
  });

  it('should handle API Gateway v2 HTTP API, payload v1 event', async () => {
    const {
      trace: {
        input: {
          spans: [{ tags }],
        },
      },
      response: { input: response },
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

    expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
    expect(tags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v1');

    expect(tags.aws.lambda.apiGateway.accountId).to.equal('205994128558');
    expect(tags.aws.lambda.apiGateway.apiId).to.equal('xxx');
    expect(tags.aws.lambda.apiGateway.apiStage).to.equal('$default');

    expect(tags.aws.lambda.apiGateway.request.id).to.equal('XyGqvi5mIAMEJtw=');
    expect(tags.aws.lambda.apiGateway.request.timeEpoch.toString()).to.equal('1662040030156');
    expect(tags.aws.lambda.http.protocol).to.equal('HTTP/1.1');
    expect(tags.aws.lambda.http.host).to.equal('xxx.execute-api.us-east-1.amazonaws.com');
    expect(tags.aws.lambda.http.requestHeaderNames).to.deep.equal([
      'Content-Length',
      'Content-Type',
      'Multi',
    ]);
    expect(tags.aws.lambda.http.method).to.equal('POST');
    expect(tags.aws.lambda.http.path).to.equal('/v1');
    expect(tags.aws.lambda.http.queryParameterNames).to.deep.equal(['lone', 'multi']);

    expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

    expect(tags.aws.lambda.httpRouter.path).to.equal('/v1');

    expect(response.body).to.deep.equal(JSON.stringify({ statusCode: 200, body: '"ok"' }));
  });

  it('should handle API Gateway v2 HTTP API, payload v2 event', async () => {
    const {
      trace: {
        input: {
          spans: [{ tags }],
        },
      },
      response: { input: response },
    } = await handleInvocation('api-endpoint', {
      isApiEndpoint: true,
      payload: {
        version: '2.0',
        routeKey: 'POST /v2',
        rawPath: '/v2',
        rawQueryString: 'lone=value&multi=one,stillone&multi=two',
        headers: {
          'content-length': '385',
          'content-type':
            'multipart/form-data; boundary=--------------------------419073009317249310175915',
          'multi': 'one,stillone,two',
        },
        queryStringParameters: {
          lone: 'value',
          multi: 'one,stillone,two',
        },
        requestContext: {
          accountId: '205994128558',
          apiId: 'xxx',
          domainName: 'xxx.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'xx',
          http: {
            method: 'POST',
            path: '/v2',
            protocol: 'HTTP/1.1',
            sourceIp: '80.55.87.22',
            userAgent: 'PostmanRuntime/7.29.0',
          },
          requestId: 'XyGnwhe0oAMEJJw=',
          routeKey: 'POST /v2',
          stage: '$default',
          time: '01/Sep/2022:13:46:51 +0000',
          timeEpoch: 1662040011065,
        },
        body: 'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==',
        isBase64Encoded: true,
      },
    });

    expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
    expect(tags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v2');

    expect(tags.aws.lambda.apiGateway.accountId).to.equal('205994128558');
    expect(tags.aws.lambda.apiGateway.apiId).to.equal('xxx');
    expect(tags.aws.lambda.apiGateway.apiStage).to.equal('$default');

    expect(tags.aws.lambda.apiGateway.request.id).to.equal('XyGnwhe0oAMEJJw=');
    expect(tags.aws.lambda.apiGateway.request.timeEpoch.toString()).to.equal('1662040011065');
    expect(tags.aws.lambda.http.protocol).to.equal('HTTP/1.1');
    expect(tags.aws.lambda.http.host).to.equal('xxx.execute-api.us-east-1.amazonaws.com');
    expect(tags.aws.lambda.http.requestHeaderNames).to.deep.equal([
      'content-length',
      'content-type',
      'multi',
    ]);

    expect(tags.aws.lambda.http.method).to.equal('POST');
    expect(tags.aws.lambda.http.path).to.equal('/v2');
    expect(tags.aws.lambda.http.queryParameterNames).to.deep.equal(['lone', 'multi']);

    expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

    expect(tags.aws.lambda.httpRouter.path).to.equal('/v2');

    expect(response.body).to.deep.equal(JSON.stringify({ statusCode: 200, body: '"ok"' }));
  });

  it('should handle function url payload event', async () => {
    const {
      trace: {
        input: {
          spans: [{ tags }],
        },
      },
      response: { input: response },
    } = await handleInvocation('api-endpoint', {
      isApiEndpoint: true,
      payload: {
        version: '2.0',
        routeKey: '$default',
        rawPath: '/function-url-test',
        rawQueryString: 'lone=value&multi=one,stillone&multi=two',
        headers: {
          'accept-encoding': 'gzip, deflate, br',
          'sec-fetch-dest': 'document',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:105.0) Gecko/20100101 Firefox/105.0',
        },
        queryStringParameters: {
          lone: 'value',
          multi: 'one,stillone,two',
        },
        requestContext: {
          accountId: 'anonymous',
          apiId: 'xxx',
          domainName: 'xxx.lambda-url.us-east-1.on.aws',
          domainPrefix: 'xxx',
          http: {
            method: 'GET',
            path: '/function-url-test',
            protocol: 'HTTP/1.1',
            sourceIp: '80.55.87.22',
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:105.0) Gecko/20100101 Firefox/105.0',
          },
          requestId: '71ab96bc-8418-4429-863d-2ad7fcbb70d0',
          routeKey: '$default',
          stage: '$default',
          time: '28/Sep/2022:16:10:24 +0000',
          timeEpoch: 1664381424747,
        },
        isBase64Encoded: false,
      },
    });

    expect(tags.aws.lambda.eventSource).to.equal('aws.lambda');
    expect(tags.aws.lambda.eventType).to.equal('aws.lambda.url');
    expect(tags.aws.lambda.http.protocol).to.equal('HTTP/1.1');
    expect(tags.aws.lambda.http.host).to.equal('xxx.lambda-url.us-east-1.on.aws');
    expect(tags.aws.lambda.http.requestHeaderNames).to.deep.equal([
      'accept-encoding',
      'sec-fetch-dest',
      'user-agent',
    ]);

    expect(tags.aws.lambda.http.method).to.equal('GET');
    expect(tags.aws.lambda.http.path).to.equal('/function-url-test');
    expect(tags.aws.lambda.http.queryParameterNames).to.deep.equal(['lone', 'multi']);

    expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

    expect(response.body).to.deep.equal(JSON.stringify({ statusCode: 200, body: '"ok"' }));
  });

  it('should handle SQS event', async () => {
    const {
      trace: {
        input: {
          spans: [{ tags }],
        },
      },
    } = await handleInvocation('callback', {
      payload: {
        Records: [
          {
            messageId: '6f606577-4d1f-455c-b504-807abed7ca02',
            receiptHandle:
              'AQEB/LOFwavQVbGysR5jhfP3AdX4MVURjti2FpQtoXmpHVtqu+/bYooyXNCiw1isU7Aa+LyAhjX1FiG7EP94Zy+oZOgVYAoBb3yCPRH5IUcRVxlK820ZOBSScsS2/7pgzaC3lZehaQ+haN3w8RZwozPp7CtUEEpNgdWbLsEE/UNI0Yr4iUf7wOXN3UFOu/A5HFgmF3LutB6bHTy7pd0ijycSkRTWGb/WvPMRZk6R496oHVg5cmp0F0OIVBbMdPyCicZcS+k+e8UzwCo+I9V0AKucXQ==',
            body: '{"foo":"bar2"}',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1662124100657',
              SequenceNumber: '18872247843477743616',
              MessageGroupId: '1662124100026',
              SenderId: 'AIDAJJ4KIO2BX5KCDWJDM',
              MessageDeduplicationId: '1662124100026',
              ApproximateFirstReceiveTimestamp: '1662124100657',
            },
            messageAttributes: {},
            md5OfBody: '1ccead62a3eb3d76d0e305271a7aa0b1',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:992311060759:test.fifo',
            awsRegion: 'us-east-1',
          },
          {
            messageId: '6f606577-4d1f-455c-0000-807abed7ca02',
            receiptHandle:
              'AQEB/LOFwavQVbGysR5jhfP3AdX4MVURjti2FpQtoXmpHVtqu+/bYooyXNCiw1isU7Aa+LyAhjX1FiG7EP94Zy+oZOgVYAoBb3yCPRH5IUcRVxlK820ZOBSScsS2/7pgzaC3lZehaQ+haN3w8RZwozPp7CtUEEpNgdWbLsEE/UNI0Yr4iUf7wOXN3UFOu/A5HFgmF3LutB6bHTy7pd0ijycSkRTWGb/WvPMRZk6R496oHVg5cmp0F0OIVBbMdPyCicZcS+k+e8UzwCo+I9V0AKucXQ==',
            body: '{"foo":"bar2"}',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1662124100657',
              SequenceNumber: '18872247843477743616',
              MessageGroupId: '1662124100026',
              SenderId: 'AIDAJJ4KIO2BX5KCDWJDM',
              MessageDeduplicationId: '1662124100026',
              ApproximateFirstReceiveTimestamp: '1662124100657',
            },
            messageAttributes: {},
            md5OfBody: '1ccead62a3eb3d76d0e305271a7aa0b1',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:992311060759:test.fifo',
            awsRegion: 'us-east-1',
          },
        ],
      },
    });

    expect(tags.aws.lambda.eventSource).to.equal('aws.sqs');
    expect(tags.aws.lambda.eventType).to.equal('aws.sqs');

    expect(tags.aws.lambda.sqs.queueName).to.equal('test.fifo');
    expect(tags.aws.lambda.sqs.messageIds).to.deep.equal([
      '6f606577-4d1f-455c-b504-807abed7ca02',
      '6f606577-4d1f-455c-0000-807abed7ca02',
    ]);
  });

  it('should handle SNS event', async () => {
    const {
      trace: {
        input: {
          spans: [{ tags }],
        },
      },
    } = await handleInvocation('callback', {
      payload: {
        Records: [
          {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn:
              'arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d',
            Sns: {
              Type: 'Notification',
              MessageId: '135f0427-2c82-5850-930b-5fb608141554',
              TopicArn: 'arn:aws:sns:us-east-1:xxx:test',
              Subject: null,
              Message: 'test-messsage3',
              Timestamp: '2022-09-06T10:35:02.094Z',
              SignatureVersion: '1',
              Signature:
                'u2Jbh9dqzF44urgO0/L+Rzo4xQ0i7v5LKzAGHYwBIkBc3JYohiVTDEHru25ygtTP6djC3FSNn54+w2FlyMemli0DlV09BInUkCwt7T2+4B2KPE8iqWMH2byXTYgOhWLoQILKr1VHv44YQA9XyjmW2aUSzitO4I8Fauld5w2kY1NsLO1UX3f/1b6UiS7+N1TiDlHYy/W2fBpcZsLUn/RxmyDTNX0mlS5Ib3fVLPsYVZQpVgHPOrchRK8PvT+UijD0utU1jt3GzURTmGxW2Ys0ICBmb4OzQhUxxHLncXbbJ2HFyVsBGElDE2w6q2kxVf7lWpE6M9F99eoU9DaY0Nhv4w==',
              SigningCertUrl:
                'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-56e67fcb41f6fec09b0196692625d385.pem',
              UnsubscribeUrl:
                'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d',
              MessageAttributes: {},
            },
          },
          {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn:
              'arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d',
            Sns: {
              Type: 'Notification',
              MessageId: '135f0427-2c82-5850-0000-5fb608141554',
              TopicArn: 'arn:aws:sns:us-east-1:xxx:test',
              Subject: null,
              Message: 'test-messsage3',
              Timestamp: '2022-09-06T10:35:02.094Z',
              SignatureVersion: '1',
              Signature:
                'u2Jbh9dqzF44urgO0/L+Rzo4xQ0i7v5LKzAGHYwBIkBc3JYohiVTDEHru25ygtTP6djC3FSNn54+w2FlyMemli0DlV09BInUkCwt7T2+4B2KPE8iqWMH2byXTYgOhWLoQILKr1VHv44YQA9XyjmW2aUSzitO4I8Fauld5w2kY1NsLO1UX3f/1b6UiS7+N1TiDlHYy/W2fBpcZsLUn/RxmyDTNX0mlS5Ib3fVLPsYVZQpVgHPOrchRK8PvT+UijD0utU1jt3GzURTmGxW2Ys0ICBmb4OzQhUxxHLncXbbJ2HFyVsBGElDE2w6q2kxVf7lWpE6M9F99eoU9DaY0Nhv4w==',
              SigningCertUrl:
                'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-56e67fcb41f6fec09b0196692625d385.pem',
              UnsubscribeUrl:
                'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d',
              MessageAttributes: {},
            },
          },
        ],
      },
    });

    expect(tags.aws.lambda.eventSource).to.equal('aws.sns');
    expect(tags.aws.lambda.eventType).to.equal('aws.sns');

    expect(tags.aws.lambda.sns.topicName).to.equal('test');
    expect(tags.aws.lambda.sns.messageIds).to.deep.equal([
      '135f0427-2c82-5850-930b-5fb608141554',
      '135f0427-2c82-5850-0000-5fb608141554',
    ]);
  });

  it('should instrument HTTP requests', async () => {
    const {
      trace: {
        input: { spans },
      },
    } = await handleInvocation('http-requester');

    const [, , invocationSpan, httpRequestSpan] = spans;

    expect(httpRequestSpan.name).to.equal('node.http.request');
    expect(httpRequestSpan.parentSpanId).to.deep.equal(invocationSpan.id);

    const { tags } = httpRequestSpan;
    expect(tags.http.method).to.equal('GET');
    expect(tags.http.protocol).to.equal('HTTP/1.1');
    expect(tags.http.host).to.equal('localhost:3177');
    expect(tags.http.path).to.equal('/');
    expect(tags.http.queryParameterNames).to.deep.equal(['foo']);
    expect(tags.http.requestHeaderNames).to.deep.equal(['someHeader']);
    expect(tags.http.statusCode.toString()).to.equal('200');
  });

  it('should instrument express', async () => {
    const {
      trace: {
        input: { spans },
      },
      response: { input: response },
    } = await handleInvocation('express', {
      isApiEndpoint: true,
      payload: {
        version: '2.0',
        routeKey: 'GET /foo',
        rawPath: '/foo',
        rawQueryString: 'lone=value&multi=one,stillone&multi=two',
        headers: {
          'content-length': '385',
          'content-type':
            'multipart/form-data; boundary=--------------------------419073009317249310175915',
          'multi': 'one,stillone,two',
        },
        queryStringParameters: {
          lone: 'value',
          multi: 'one,stillone,two',
        },
        requestContext: {
          accountId: '205994128558',
          apiId: 'xxx',
          domainName: 'xxx.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'xx',
          http: {
            method: 'GET',
            path: '/foo',
            protocol: 'HTTP/1.1',
            sourceIp: '80.55.87.22',
            userAgent: 'PostmanRuntime/7.29.0',
          },
          requestId: 'XyGnwhe0oAMEJJw=',
          routeKey: 'GET /foo',
          stage: '$default',
          time: '01/Sep/2022:13:46:51 +0000',
          timeEpoch: 1662040011065,
        },
        body: 'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==',
        isBase64Encoded: true,
      },
    });

    const [lambdaSpan, , invocationSpan, expressSpan, ...middlewareSpans] = spans;
    const routeSpan = middlewareSpans.pop();
    const routerSpan = middlewareSpans[middlewareSpans.length - 1];

    const lambdaTags = lambdaSpan.tags;

    expect(lambdaTags.aws.lambda.eventSource).to.equal('aws.apigateway');
    expect(lambdaTags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v2');

    expect(lambdaTags.aws.lambda.apiGateway.accountId).to.equal('205994128558');
    expect(lambdaTags.aws.lambda.apiGateway.apiId).to.equal('xxx');
    expect(lambdaTags.aws.lambda.apiGateway.apiStage).to.equal('$default');

    expect(lambdaTags.aws.lambda.apiGateway.request.id).to.equal('XyGnwhe0oAMEJJw=');
    expect(lambdaTags.aws.lambda.apiGateway.request.timeEpoch.toString()).to.equal('1662040011065');
    expect(lambdaTags.aws.lambda.http.protocol).to.equal('HTTP/1.1');
    expect(lambdaTags.aws.lambda.http.host).to.equal('xxx.execute-api.us-east-1.amazonaws.com');

    expect(lambdaTags.aws.lambda.http.requestHeaderNames).to.deep.equal([
      'content-length',
      'content-type',
      'multi',
    ]);

    expect(lambdaTags.aws.lambda.http.method).to.equal('GET');
    expect(lambdaTags.aws.lambda.http.path).to.equal('/foo');
    expect(lambdaTags.aws.lambda.http.queryParameterNames).to.deep.equal(['lone', 'multi']);

    expect(lambdaTags.aws.lambda.http.statusCode.toString()).to.equal('200');

    expect(lambdaTags.aws.lambda.httpRouter.path).to.equal('/foo');

    expect(JSON.parse(response.body).body).to.deep.equal(JSON.stringify('ok'));

    expect(expressSpan.name).to.equal('express');
    expect(expressSpan.parentSpanId).to.deep.equal(invocationSpan.id);

    expect(middlewareSpans.map(({ name }) => name)).to.deep.equal([
      'express.middleware.query',
      'express.middleware.expressinit',
      'express.middleware.jsonparser',
      'express.middleware.router',
    ]);
    for (const middlewareSpan of middlewareSpans) {
      expect(String(middlewareSpan.parentSpanId)).to.equal(String(expressSpan.id));
    }
    expect(routeSpan.name).to.equal('express.middleware.route.get.anonymous');
    expect(String(routeSpan.parentSpanId)).to.equal(String(routerSpan.id));
  });

  it('should handle properly multiple async flows', async () => {
    const {
      trace: {
        input: { spans },
      },
    } = await handleInvocation('multi-async');

    const [lambdaSpan, , invocationSpan, expressSpan, ...otherSpans] = spans;
    const middlewareSpans = otherSpans.slice(0, -4);
    const routeSpan = middlewareSpans.pop();
    const routerSpan = middlewareSpans[middlewareSpans.length - 1];
    const expressRequest1Span = otherSpans[otherSpans.length - 4];
    const expressRequest2Span = otherSpans[otherSpans.length - 3];
    const outerRequest1Span = otherSpans[otherSpans.length - 2];
    const outerRequest2Span = otherSpans[otherSpans.length - 1];

    expect(lambdaSpan.tags.aws.lambda.httpRouter.path).to.equal('/foo');

    expect(expressSpan.name).to.equal('express');
    expect(expressSpan.parentSpanId).to.deep.equal(invocationSpan.id);

    expect(middlewareSpans.map(({ name }) => name)).to.deep.equal([
      'express.middleware.query',
      'express.middleware.expressinit',
      'express.middleware.jsonparser',
      'express.middleware.router',
    ]);
    for (const middlewareSpan of middlewareSpans) {
      expect(String(middlewareSpan.parentSpanId)).to.equal(String(expressSpan.id));
    }
    expect(routeSpan.name).to.equal('express.middleware.route.get.anonymous');
    expect(String(routeSpan.parentSpanId)).to.equal(String(routerSpan.id));

    expect(outerRequest1Span.name).to.equal('node.http.request');
    expect(outerRequest1Span.parentSpanId).to.deep.equal(invocationSpan.id);
    expect(outerRequest2Span.name).to.equal('node.http.request');
    expect(outerRequest2Span.parentSpanId).to.deep.equal(invocationSpan.id);

    const { tags: outerRequest1Tags } = outerRequest1Span;
    expect(outerRequest1Tags.http.method).to.equal('POST');
    expect(outerRequest1Tags.http.protocol).to.equal('HTTP/1.1');
    expect(outerRequest1Tags.http.host).to.equal('localhost:3177');
    expect(outerRequest1Tags.http.path).to.equal('/out-1');
    expect(outerRequest1Tags.http.statusCode.toString()).to.equal('200');

    expect(expressRequest1Span.name).to.equal('node.http.request');
    expect(expressRequest1Span.parentSpanId).to.deep.equal(routeSpan.id);
    expect(expressRequest2Span.name).to.equal('node.http.request');
    expect(expressRequest2Span.parentSpanId).to.deep.equal(routeSpan.id);

    const { tags: expressRequest1Tags } = expressRequest1Span;
    expect(expressRequest1Tags.http.method).to.equal('POST');
    expect(expressRequest1Tags.http.protocol).to.equal('HTTP/1.1');
    expect(expressRequest1Tags.http.host).to.equal('localhost:3177');
    expect(expressRequest1Tags.http.path).to.equal('/in-1');
    expect(expressRequest1Tags.http.statusCode.toString()).to.equal('200');
  });

  it('should expose working SDK', async () => {
    const {
      trace: { input: trace },
      result,
    } = await handleInvocation('sdk', {
      isCustomReponse: true,
      payload: { isTriggeredByUnitTest: true },
    });

    const { spans, events, customTags } = trace;

    expect(spans.map(({ name }) => name)).to.deep.equal([
      'aws.lambda',
      'aws.lambda.initialization',
      'aws.lambda.invocation',
      'user.span',
    ]);
    expect(result.name).to.equal(pkgJson.name);
    expect(result.version).to.equal(pkgJson.version);
    expect(result.rootSpanName).to.equal('aws.lambda');
    expect(JSON.parse(customTags)).to.deep.equal({ 'user.tag': `example:${1}` });

    const normalizeEvent = (event) => {
      event = { ...event };
      expect(Buffer.isBuffer(event.id)).to.be.true;
      expect(typeof event.timestampUnixNano).to.equal('number');
      if (event.tags.error) {
        delete event.tags.error.stacktrace;
        if (event.tags.error.message) {
          event.tags.error.message = event.tags.error.message.split('\n')[0];
        }
      }
      if (event.tags.warning) {
        delete event.tags.warning.stacktrace;
      }
      delete event.id;
      delete event.timestampUnixNano;
      return event;
    };
    const { traceId, spanId } = events[0];
    expect(events.map(normalizeEvent)).to.deep.equal([
      {
        traceId,
        spanId,
        eventName: 'telemetry.error.generated.v1',
        customTags: JSON.stringify({ 'user.tag': 'example', 'invocationid': 1 }),
        tags: {
          error: {
            name: 'Error',
            message: 'Captured error',
            type: 2,
          },
        },
      },
      {
        traceId,
        spanId,
        eventName: 'telemetry.error.generated.v1',
        customTags: JSON.stringify({}),
        tags: {
          error: {
            name: 'string',
            message: 'My error: Error: Consoled error',
            type: 2,
          },
        },
      },
      {
        traceId,
        spanId,
        eventName: 'telemetry.warning.generated.v1',
        customTags: JSON.stringify({ 'user.tag': 'example', 'invocationid': 1 }),
        tags: {
          warning: {
            message: 'Captured warning',
            type: 1,
          },
        },
      },
      {
        traceId,
        spanId,
        eventName: 'telemetry.warning.generated.v1',
        customTags: JSON.stringify({}),
        tags: {
          warning: {
            message: 'Consoled warning 12 true',
            type: 1,
          },
        },
      },
    ]);
  });

  describe('dev mode', () => {
    let server;
    let payloads = [];

    const resolvePayloadsSummary = () => {
      const payloadsSummary = { requestResponses: [], traceSpans: [], traceEvents: [] };
      for (const [type, payload] of payloads) {
        switch (type) {
          case 'request-response':
            payloadsSummary.requestResponses.push({ origin: payload.origin });
            break;
          case 'trace':
            payloadsSummary.traceSpans.push(
              ...payload.spans.map(({ name, input, output }) => ({ name, input, output }))
            );
            payloadsSummary.traceEvents.push(
              ...payload.events.map(({ eventName }) => ({ eventName }))
            );
            break;
          default:
            throw new Error('Unexpected');
        }
      }
      return payloadsSummary;
    };

    before(() => {
      const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
      const { RequestResponse } = require('@serverless/sdk-schema/dist/request_response');
      process.env.SLS_DEV_MODE_ORG_ID = 'test';
      server = http.createServer((request, response) => {
        if (request.method !== 'GET') throw new Error(`Unexpected method:${request.method}`);

        let payload = Buffer.from('');
        request.on('data', (chunk) => {
          payload = Buffer.concat([payload, chunk]);
        });
        request.on('end', () => {
          response.writeHead(200, {});
          response.end('OK');
          const payloadType = request.url.slice(1);
          const decodedPayload =
            payloadType === 'request-response'
              ? RequestResponse.decode(payload)
              : TracePayload.decode(payload);
          payloads.push([payloadType, decodedPayload]);
        });
      });

      server.listen(2773);
    });

    afterEach(() => {
      payloads = [];
    });

    after(() => {
      delete process.env.SLS_DEV_MODE_ORG_ID;
      server.close();
    });

    it('should provide general support', async () => {
      const {
        trace: {
          input: { spans },
        },
      } = await handleInvocation('multi-async');
      for (const httpSpan of spans.slice(-4)) {
        expect(httpSpan.name).to.equal('node.http.request');
        expect(httpSpan.input).to.be.undefined;
        expect(httpSpan.output).to.be.undefined;
      }

      expect(resolvePayloadsSummary()).to.deep.equal({
        requestResponses: [{ origin: 1 }, { origin: 2 }],
        traceSpans: [
          { name: 'aws.lambda.initialization', input: undefined, output: undefined },
          { name: 'express.middleware.query', input: undefined, output: undefined },
          { name: 'express.middleware.expressinit', input: undefined, output: undefined },
          { name: 'express.middleware.jsonparser', input: undefined, output: undefined },
          {
            name: 'node.http.request',
            input: 'test',
            output: '"ok"',
          },
          {
            name: 'node.http.request',
            input: 'test',
            output: '"ok"',
          },
          {
            name: 'node.http.request',
            input: 'test',
            output: '"ok"',
          },
          {
            name: 'node.http.request',
            input: 'test',
            output: '"ok"',
          },
          { name: 'express.middleware.router', input: undefined, output: undefined },
          { name: 'express.middleware.route.get.anonymous', input: undefined, output: undefined },
          { name: 'express', input: undefined, output: undefined },
          { name: 'aws.lambda.invocation', input: undefined, output: undefined },
          { name: 'aws.lambda', input: undefined, output: undefined },
        ],
        traceEvents: [],
      });
    });
    it('should report captured events', async () => {
      await handleInvocation('sdk', {
        isCustomReponse: true,
        payload: { isTriggeredByUnitTest: true },
      });

      expect(resolvePayloadsSummary()).to.deep.equal({
        requestResponses: [{ origin: 1 }, { origin: 2 }],
        traceSpans: [
          { name: 'aws.lambda.initialization', input: undefined, output: undefined },
          { name: 'user.span', input: undefined, output: undefined },
          { name: 'aws.lambda.invocation', input: undefined, output: undefined },
          { name: 'aws.lambda', input: undefined, output: undefined },
        ],
        traceEvents: [
          { eventName: 'telemetry.error.generated.v1' },
          { eventName: 'telemetry.error.generated.v1' },
          { eventName: 'telemetry.warning.generated.v1' },
          { eventName: 'telemetry.warning.generated.v1' },
        ],
      });
    });

    it('should support no return functions', async () => {
      await handleInvocation('callback-no-result', { isCustomReponse: true });

      expect(resolvePayloadsSummary()).to.deep.equal({
        requestResponses: [{ origin: 1 }, { origin: 2 }],
        traceSpans: [
          { name: 'aws.lambda.initialization', input: undefined, output: undefined },
          { name: 'aws.lambda.invocation', input: undefined, output: undefined },
          { name: 'aws.lambda', input: undefined, output: undefined },
        ],
        traceEvents: [],
      });
    });
  });
});
