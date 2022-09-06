'use strict';

const { expect } = require('chai');

const path = require('path');
const log = require('log').get('test');
const wait = require('timers-ext/promise/sleep');
const { APIGateway } = require('@aws-sdk/client-api-gateway');
const { ApiGatewayV2 } = require('@aws-sdk/client-apigatewayv2');
const { Lambda } = require('@aws-sdk/client-lambda');
const { SQS } = require('@aws-sdk/client-sqs');
const { SNS } = require('@aws-sdk/client-sns');
const { default: fetch } = require('node-fetch');
const cleanup = require('../lib/cleanup');
const createCoreResources = require('../lib/create-core-resources');
const processFunction = require('../lib/process-function');
const resolveTestVariantsConfig = require('../lib/resolve-test-variants-config');
const awsRequest = require('../utils/aws-request');
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

  const getCreateHttpApi = (payloadFormatVersion) => async (testConfig) => {
    const apiId = (testConfig.apiId = (
      await awsRequest(ApiGatewayV2, 'createApi', {
        Name: testConfig.configuration.FunctionName,
        ProtocolType: 'HTTP',
      })
    ).ApiId);
    const deferredAddPermission = awsRequest(Lambda, 'addPermission', {
      FunctionName: testConfig.configuration.FunctionName,
      Principal: '*',
      Action: 'lambda:InvokeFunction',
      SourceArn: `arn:aws:execute-api:${process.env.AWS_REGION}:${coreConfig.accountId}:${apiId}/*`,
      StatementId: testConfig.name,
    });
    const integrationId = (
      await awsRequest(ApiGatewayV2, 'createIntegration', {
        ApiId: apiId,
        IntegrationType: 'AWS_PROXY',
        IntegrationUri: `arn:aws:lambda:${process.env.AWS_REGION}:${coreConfig.accountId}:function:${testConfig.configuration.FunctionName}`,
        PayloadFormatVersion: payloadFormatVersion,
      })
    ).IntegrationId;

    await awsRequest(ApiGatewayV2, 'createRoute', {
      ApiId: apiId,
      RouteKey: 'POST /test',
      Target: `integrations/${integrationId}`,
    });

    await awsRequest(ApiGatewayV2, 'createStage', {
      ApiId: apiId,
      StageName: '$default',
      AutoDeploy: true,
    });

    await deferredAddPermission;
  };

  const createEventSourceMapping = async (functionName, eventSourceArn) => {
    try {
      return (
        await awsRequest(Lambda, 'createEventSourceMapping', {
          FunctionName: functionName,
          EventSourceArn: eventSourceArn,
        })
      ).UUID;
    } catch (error) {
      if (error.message.includes('Please update or delete the existing mapping with UUID')) {
        const previousUuid = error.message
          .slice(error.message.indexOf('with UUID ') + 'with UUID '.length)
          .trim();
        log.notice(
          'Found existing event source mapping (%s) for %s, reusing',
          previousUuid,
          functionName
        );
        return previousUuid;
      }
      throw error;
    }
  };

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
          [
            'sqs',
            {
              isAsyncInvocation: true,
              hooks: {
                afterCreate: async function self(testConfig) {
                  const queueName =
                    (testConfig.queueName = `${testConfig.configuration.FunctionName}.fifo`);
                  try {
                    testConfig.queueUrl = (
                      await awsRequest(SQS, 'createQueue', {
                        QueueName: queueName,
                        Attributes: { FifoQueue: true },
                      })
                    ).QueueUrl;
                  } catch (error) {
                    if (error.code === 'AWS.SimpleQueueService.QueueDeletedRecently') {
                      log.notice(
                        'Queue of same name was deleted recently, we must wait up to 60s to continue'
                      );
                      await wait(10000);
                      await self(testConfig);
                      return;
                    }
                    throw error;
                  }
                  const queueArn = `arn:aws:sqs:${process.env.AWS_REGION}:${coreConfig.accountId}:${queueName}`;
                  const sourceMappingUuid = (testConfig.sourceMappingUuid =
                    await createEventSourceMapping(
                      testConfig.configuration.FunctionName,
                      queueArn
                    ));
                  let queueState;
                  do {
                    await wait(300);
                    queueState = (
                      await awsRequest(Lambda, 'getEventSourceMapping', {
                        UUID: sourceMappingUuid,
                      })
                    ).State;
                  } while (queueState !== 'Enabled');
                },
                beforeDelete: async (testConfig) => {
                  await Promise.all([
                    awsRequest(Lambda, 'deleteEventSourceMapping', {
                      UUID: testConfig.sourceMappingUuid,
                    }),
                    awsRequest(SQS, 'deleteQueue', { QueueUrl: testConfig.queueUrl }),
                  ]);
                },
              },
              invoke: async (testConfig) => {
                const startTime = process.hrtime.bigint();
                await awsRequest(SQS, 'sendMessage', {
                  QueueUrl: testConfig.queueUrl,
                  MessageBody: 'test',
                  MessageGroupId: String(Date.now()),
                  MessageDeduplicationId: String(Date.now()),
                });
                let pendingMessages;
                do {
                  await wait(300);
                  const { Attributes: attributes } = await awsRequest(SQS, 'getQueueAttributes', {
                    QueueUrl: testConfig.queueUrl,
                    AttributeNames: ['All'],
                  });
                  pendingMessages =
                    Number(attributes.ApproximateNumberOfMessages) +
                    Number(attributes.ApproximateNumberOfMessagesNotVisible) +
                    Number(attributes.ApproximateNumberOfMessagesDelayed);
                } while (pendingMessages);

                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                return { duration };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const [, trace] of invocationsData.map((data) => data.trace).entries()) {
                  const { tags } = trace.spans[0];

                  expect(tags['aws.lambda.sqs.queue_name']).to.equal(testConfig.queueName);
                  expect(tags['aws.lambda.sqs.message_ids'].length).to.equal(1);
                }
              },
            },
          ],
          [
            'sns',
            {
              isAsyncInvocation: true,
              hooks: {
                afterCreate: async function self(testConfig) {
                  const topicName = (testConfig.topicName = testConfig.configuration.FunctionName);
                  await awsRequest(SNS, 'createTopic', { Name: topicName });
                  const topicArn = (testConfig.topicArn =
                    `arn:aws:sns:${process.env.AWS_REGION}:` +
                    `${coreConfig.accountId}:${topicName}`);
                  await Promise.all([
                    awsRequest(Lambda, 'addPermission', {
                      FunctionName: testConfig.configuration.FunctionName,
                      Principal: '*',
                      Action: 'lambda:InvokeFunction',
                      SourceArn: topicArn,
                      StatementId: 'sns',
                    }),
                    awsRequest(SNS, 'subscribe', {
                      TopicArn: topicArn,
                      Protocol: 'lambda',
                      Endpoint:
                        `arn:aws:lambda:${process.env.AWS_REGION}:${coreConfig.accountId}` +
                        `:function:${testConfig.configuration.FunctionName}`,
                    }),
                  ]);
                },
                beforeDelete: async (testConfig) => {
                  await Promise.all([
                    awsRequest(SNS, 'deleteTopic', { TopicArn: testConfig.topicArn }),
                  ]);
                },
              },
              invoke: async (testConfig) => {
                const startTime = process.hrtime.bigint();
                await awsRequest(SNS, 'publish', {
                  TopicArn: testConfig.topicArn,
                  Message: 'test',
                });
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                return { duration };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const [, trace] of invocationsData.map((data) => data.trace).entries()) {
                  const { tags } = trace.spans[0];

                  expect(tags['aws.lambda.sns.topic_name']).to.equal(testConfig.topicName);
                  expect(tags['aws.lambda.sns.message_ids'].length).to.equal(1);
                }
              },
            },
          ],
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
    [
      'api-endpoint',
      {
        variants: new Map([
          [
            'rest-api',
            {
              hooks: {
                afterCreate: async (testConfig) => {
                  const restApiId = (testConfig.restApiId = (
                    await awsRequest(APIGateway, 'createRestApi', {
                      name: testConfig.configuration.FunctionName,
                    })
                  ).id);
                  const deferredAddPermission = awsRequest(Lambda, 'addPermission', {
                    FunctionName: testConfig.configuration.FunctionName,
                    Principal: '*',
                    Action: 'lambda:InvokeFunction',
                    SourceArn: `arn:aws:execute-api:${process.env.AWS_REGION}:${coreConfig.accountId}:${restApiId}/*/*`,
                    StatementId: 'rest-api',
                  });
                  const rootResourceId = (
                    await awsRequest(APIGateway, 'getResources', {
                      restApiId,
                    })
                  ).items[0].id;
                  const interimResourceId = (
                    await awsRequest(APIGateway, 'createResource', {
                      restApiId,
                      parentId: rootResourceId,
                      pathPart: 'some-path',
                    })
                  ).id;
                  const resourceId = (
                    await awsRequest(APIGateway, 'createResource', {
                      restApiId,
                      parentId: interimResourceId,
                      pathPart: '{param}',
                    })
                  ).id;
                  await awsRequest(APIGateway, 'putMethod', {
                    restApiId,
                    resourceId,
                    httpMethod: 'POST',
                    authorizationType: 'NONE',
                    requestParameters: { 'method.request.path.param': true },
                  });
                  await awsRequest(APIGateway, 'putIntegration', {
                    restApiId,
                    resourceId,
                    httpMethod: 'POST',
                    integrationHttpMethod: 'POST',
                    type: 'AWS_PROXY',
                    uri: `arn:aws:apigateway:${process.env.AWS_REGION}:lambda:path/2015-03-31/functions/${testConfig.functionArn}/invocations`,
                  });
                  await awsRequest(APIGateway, 'createDeployment', {
                    restApiId,
                    stageName: 'test',
                  });
                  await deferredAddPermission;
                },
                beforeDelete: async (testConfig) => {
                  await awsRequest(APIGateway, 'deleteRestApi', {
                    restApiId: testConfig.restApiId,
                  });
                },
              },
              invoke: async (testConfig) => {
                const startTime = process.hrtime.bigint();
                const response = await fetch(
                  `https://${testConfig.restApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/test/some-path/some-param`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ some: 'content' }),
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }
                );
                if (response.status !== 200) {
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const [, trace] of invocationsData.map((data) => data.trace).entries()) {
                  const { tags } = trace.spans[0];

                  expect(tags).to.have.property('aws.lambda.api_gateway.account_id');
                  expect(tags['aws.lambda.api_gateway.api_id']).to.equal(testConfig.restApiId);
                  expect(tags['aws.lambda.api_gateway.api_stage']).to.equal('test');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.id');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.time_epoch');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.domain');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.headers');
                  expect(tags['aws.lambda.api_gateway.request.method']).to.equal('POST');
                  expect(tags['aws.lambda.api_gateway.request.path']).to.equal(
                    '/test/some-path/some-param'
                  );
                  expect(tags['aws.lambda.api_gateway.request.path_parameters']).to.equal(
                    JSON.stringify({ param: 'some-param' })
                  );
                }
              },
            },
          ],
          [
            'http-api-v1',
            {
              hooks: {
                afterCreate: getCreateHttpApi('1.0'),
                beforeDelete: async (testConfig) => {
                  await awsRequest(ApiGatewayV2, 'deleteApi', { ApiId: testConfig.apiId });
                },
              },
              invoke: async (testConfig) => {
                const startTime = process.hrtime.bigint();
                const response = await fetch(
                  `https://${testConfig.apiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/test`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ some: 'content' }),
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }
                );
                if (response.status !== 200) {
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const [, trace] of invocationsData.map((data) => data.trace).entries()) {
                  const { tags } = trace.spans[0];

                  expect(tags).to.have.property('aws.lambda.api_gateway.account_id');
                  expect(tags['aws.lambda.api_gateway.api_id']).to.equal(testConfig.apiId);
                  expect(tags['aws.lambda.api_gateway.api_stage']).to.equal('$default');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.id');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.time_epoch');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.domain');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.headers');
                  expect(tags['aws.lambda.api_gateway.request.method']).to.equal('POST');
                  expect(tags['aws.lambda.api_gateway.request.path']).to.equal('/test');
                }
              },
            },
          ],
          [
            'http-api-v2',
            {
              hooks: {
                afterCreate: getCreateHttpApi('2.0'),
                beforeDelete: async (testConfig) => {
                  await awsRequest(ApiGatewayV2, 'deleteApi', { ApiId: testConfig.apiId });
                },
              },
              invoke: async (testConfig) => {
                const startTime = process.hrtime.bigint();
                const response = await fetch(
                  `https://${testConfig.apiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/test`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ some: 'content' }),
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  }
                );
                if (response.status !== 200) {
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const [, trace] of invocationsData.map((data) => data.trace).entries()) {
                  const { tags } = trace.spans[0];

                  expect(tags).to.have.property('aws.lambda.api_gateway.account_id');
                  expect(tags['aws.lambda.api_gateway.api_id']).to.equal(testConfig.apiId);
                  expect(tags['aws.lambda.api_gateway.api_stage']).to.equal('$default');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.id');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.time_epoch');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.domain');
                  expect(tags).to.have.property('aws.lambda.api_gateway.request.headers');
                  expect(tags['aws.lambda.api_gateway.request.method']).to.equal('POST');
                  expect(tags['aws.lambda.api_gateway.request.path']).to.equal('/test');
                }
              },
            },
          ],
        ]),
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
        testConfig.test({ invocationsData, testConfig });
      }
    });
  }

  after(async () => cleanup({ mode: 'core' }));
});
