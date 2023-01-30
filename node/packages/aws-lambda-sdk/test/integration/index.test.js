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
const { TracePayload } = require('@serverless/sdk-schema/dist/trace');
const { default: fetch } = require('node-fetch');
const basename = require('../lib/basename');
const cleanup = require('../lib/cleanup');
const createCoreResources = require('../lib/create-core-resources');
const getProcessFunction = require('../../../../test/lib/get-process-function');
const resolveTestVariantsConfig = require('../../../../test/lib/resolve-test-variants-config');
const resolveFileZipBuffer = require('../utils/resolve-file-zip-buffer');
const awsRequest = require('../../../../test/utils/aws-request');
const pkgJson = require('../../package');

const fixturesDirname = path.resolve(__dirname, '../fixtures/lambdas');

for (const name of ['TEST_INTERNAL_LAYER_FILENAME']) {
  // In tests, current working directory is mocked,
  // so if relative path is provided in env var it won't be resolved properly
  // with this patch we resolve it before cwd mocking
  if (process.env[name]) process.env[name] = path.resolve(process.env[name]);
}

describe('integration', function () {
  this.timeout(180000);
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

  const testAwsSdk = ({ testConfig, invocationsData }) => {
    for (const [
      index,
      {
        trace: { spans },
      },
    ] of invocationsData.entries()) {
      spans.shift();
      if (!index) spans.shift();
      const [
        invocationSpan,
        stsSpan,
        sqsCreateSpan,
        sqsSendSpan,
        sqsDeleteSpan,
        snsCreateSpan,
        snsPublishSpan,
        snsDeleteSpan,
        dynamodbCreateSpan,
        dynamodbDescribeSpan,
        ...dynamodbSpans
      ] = spans;

      // STS
      expect(stsSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(stsSpan.name).to.equal('aws.sdk.sts.getcalleridentity');
      let sdkTags = stsSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sts');
      expect(sdkTags.operation).to.equal('getcalleridentity');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');

      // SNS
      const queueName = `${testConfig.configuration.FunctionName}-${index + 1}.fifo`;
      // Create
      expect(sqsCreateSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(sqsCreateSpan.name).to.equal('aws.sdk.sqs.createqueue');
      sdkTags = sqsCreateSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sqs');
      expect(sdkTags.operation).to.equal('createqueue');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sqs.queueName).to.equal(queueName);
      // Send
      expect(sqsSendSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(sqsSendSpan.name).to.equal('aws.sdk.sqs.sendmessage');
      sdkTags = sqsSendSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sqs');
      expect(sdkTags.operation).to.equal('sendmessage');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sqs.queueName).to.equal(queueName);
      expect(sdkTags.sqs.messageIds.length).to.equal(1);
      // Delete
      expect(sqsDeleteSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(sqsDeleteSpan.name).to.equal('aws.sdk.sqs.deletequeue');
      sdkTags = sqsDeleteSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sqs');
      expect(sdkTags.operation).to.equal('deletequeue');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sqs.queueName).to.equal(queueName);

      // SQS
      const topicName = `${testConfig.configuration.FunctionName}-${index + 1}`;
      // Create
      expect(snsCreateSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(snsCreateSpan.name).to.equal('aws.sdk.sns.createtopic');
      sdkTags = snsCreateSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sns');
      expect(sdkTags.operation).to.equal('createtopic');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sns.topicName).to.equal(topicName);
      // Send
      expect(snsPublishSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(snsPublishSpan.name).to.equal('aws.sdk.sns.publish');
      sdkTags = snsPublishSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sns');
      expect(sdkTags.operation).to.equal('publish');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sns.topicName).to.equal(topicName);
      expect(sdkTags.sns.messageIds.length).to.equal(1);
      // Delete
      expect(snsDeleteSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(snsDeleteSpan.name).to.equal('aws.sdk.sns.deletetopic');
      sdkTags = snsDeleteSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('sns');
      expect(sdkTags.operation).to.equal('deletetopic');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.sns.topicName).to.equal(topicName);

      // Dynamodb
      const tableName = `${testConfig.configuration.FunctionName}-${index + 1}`;
      // Create
      expect(dynamodbCreateSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(dynamodbCreateSpan.name).to.equal('aws.sdk.dynamodb.createtable');
      sdkTags = dynamodbCreateSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('dynamodb');
      expect(sdkTags.operation).to.equal('createtable');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
      // Describe
      expect(dynamodbDescribeSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(dynamodbDescribeSpan.name).to.equal('aws.sdk.dynamodb.describetable');
      sdkTags = dynamodbDescribeSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('dynamodb');
      expect(sdkTags.operation).to.equal('describetable');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
      while (dynamodbSpans[0].name === 'aws.sdk.dynamodb.describetable') {
        dynamodbSpans.shift();
      }
      const [
        dynamodbPutItemSpan,
        dynamodbQuerySpan,
        dynamodbDocumentClientSpan,
        dynamodbDeleteSpan,
      ] = dynamodbSpans;
      // Put item
      expect(dynamodbPutItemSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(dynamodbPutItemSpan.name).to.equal('aws.sdk.dynamodb.putitem');
      sdkTags = dynamodbPutItemSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('dynamodb');
      expect(sdkTags.operation).to.equal('putitem');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
      // Query
      expect(dynamodbQuerySpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(dynamodbQuerySpan.name).to.equal('aws.sdk.dynamodb.query');
      sdkTags = dynamodbQuerySpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('dynamodb');
      expect(sdkTags.operation).to.equal('query');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
      expect(sdkTags.dynamodb.keyCondition).to.equal('#id = :id');
      // Query with document client
      const dynamoDbServiceName = testConfig.configuration.FunctionName.includes('aws-sdk-v2')
        ? 'dynamodb'
        : 'dynamodbdocument';
      expect(dynamodbDocumentClientSpan.parentSpanId.toString()).to.equal(
        invocationSpan.id.toString()
      );
      expect(dynamodbDocumentClientSpan.name).to.equal(`aws.sdk.${dynamoDbServiceName}.query`);
      sdkTags = dynamodbDocumentClientSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal(dynamoDbServiceName);
      expect(sdkTags.operation).to.equal('query');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
      expect(sdkTags.dynamodb.keyCondition).to.equal('#id = :id');
      // Delete
      expect(dynamodbDeleteSpan.parentSpanId.toString()).to.equal(invocationSpan.id.toString());
      expect(dynamodbDeleteSpan.name).to.equal('aws.sdk.dynamodb.deletetable');
      sdkTags = dynamodbDeleteSpan.tags.aws.sdk;
      expect(sdkTags.region).to.equal(process.env.AWS_REGION);
      expect(sdkTags.signatureVersion).to.equal('v4');
      expect(sdkTags.service).to.equal('dynamodb');
      expect(sdkTags.operation).to.equal('deletetable');
      expect(sdkTags).to.have.property('requestId');
      expect(sdkTags).to.not.have.property('error');
      expect(sdkTags.dynamodb.tableName).to.equal(tableName);
    }
  };

  const devModeConfiguration = {
    configuration: {
      Environment: {
        Variables: {
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
          SLS_ORG_ID: process.env.SLS_ORG_ID,
          SLS_DEV_MODE_ORG_ID: process.env.SLS_ORG_ID,
          SLS_SDK_DEBUG: '1',
        },
      },
    },
    deferredConfiguration: () => ({
      Layers: [coreConfig.layerInternalArn, coreConfig.layerExternalArn],
    }),
  };

  const useCasesConfig = new Map([
    [
      'esm-callback/index',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
      },
    ],
    [
      'esm-thenable/index',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
      },
    ],
    [
      'esm-nested/nested/within/index',
      {
        variants: new Map([
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
      },
    ],
    [
      'callback',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
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
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.sqs');
                  expect(tags.aws.lambda.eventType).to.equal('aws.sqs');

                  expect(tags.aws.lambda.sqs.queueName).to.equal(testConfig.queueName);
                  expect(tags.aws.lambda.sqs.messageIds.length).to.equal(1);
                }
              },
            },
          ],
          [
            'sns',
            {
              isAsyncInvocation: true,
              ignoreMultipleInvocations: true,
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
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.sns');
                  expect(tags.aws.lambda.eventType).to.equal('aws.sns');

                  expect(tags.aws.lambda.sns.topicName).to.equal(testConfig.topicName);
                  expect(tags.aws.lambda.sns.messageIds.length).to.equal(1);
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
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
      },
    ],
    [
      'thenable',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
      },
    ],
    [
      'callback-error',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:handled' },
      },
    ],
    [
      'thenable-error',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:handled' },
      },
    ],
    [
      'error-uncaught',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:unhandled' },
      },
    ],
    [
      'error-uncaught-immediate',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:unhandled' },
      },
    ],
    [
      'error-uncaught-resolution-race',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:unhandled' },
      },
    ],
    [
      'error-unhandled',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: { expectedOutcome: 'error:unhandled' },
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
              invoke: async function self(testConfig) {
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
                  if (response.status === 404) {
                    await wait(1000);
                    return self(testConfig);
                  }
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
                  expect(tags.aws.lambda.eventType).to.equal('aws.apigateway.rest');

                  expect(tags.aws.lambda.apiGateway).to.have.property('accountId');
                  expect(tags.aws.lambda.apiGateway.apiId).to.equal(testConfig.restApiId);
                  expect(tags.aws.lambda.apiGateway.apiStage).to.equal('test');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('id');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('timeEpoch');
                  expect(tags.aws.lambda.http).to.have.property('host');
                  expect(tags.aws.lambda.http).to.have.property('requestHeaderNames');
                  expect(tags.aws.lambda.http.method).to.equal('POST');
                  expect(tags.aws.lambda.http.path).to.equal('/test/some-path/some-param');
                  expect(tags.aws.lambda.apiGateway.request.pathParameterNames).to.deep.equal([
                    'param',
                  ]);

                  expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

                  expect(tags.aws.lambda.httpRouter.path).to.equal('/some-path/{param}');
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
              invoke: async function self(testConfig) {
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
                  if (response.status === 404) {
                    await wait(1000);
                    return self(testConfig);
                  }
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
                  expect(tags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v1');

                  expect(tags.aws.lambda.apiGateway).to.have.property('accountId');
                  expect(tags.aws.lambda.apiGateway.apiId).to.equal(testConfig.apiId);
                  expect(tags.aws.lambda.apiGateway.apiStage).to.equal('$default');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('id');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('timeEpoch');
                  expect(tags.aws.lambda.http).to.have.property('host');
                  expect(tags.aws.lambda.http).to.have.property('requestHeaderNames');
                  expect(tags.aws.lambda.http.method).to.equal('POST');
                  expect(tags.aws.lambda.http.path).to.equal('/test');

                  expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

                  expect(tags.aws.lambda.httpRouter.path).to.equal('/test');
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
              invoke: async function self(testConfig) {
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
                  if (response.status === 404) {
                    await wait(1000);
                    return self(testConfig);
                  }
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData, testConfig }) => {
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.apigateway');
                  expect(tags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v2');

                  expect(tags.aws.lambda.apiGateway).to.have.property('accountId');
                  expect(tags.aws.lambda.apiGateway.apiId).to.equal(testConfig.apiId);
                  expect(tags.aws.lambda.apiGateway.apiStage).to.equal('$default');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('id');
                  expect(tags.aws.lambda.apiGateway.request).to.have.property('timeEpoch');
                  expect(tags.aws.lambda.http).to.have.property('host');
                  expect(tags.aws.lambda.http).to.have.property('requestHeaderNames');
                  expect(tags.aws.lambda.http.method).to.equal('POST');
                  expect(tags.aws.lambda.http.path).to.equal('/test');

                  expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');

                  expect(tags.aws.lambda.httpRouter.path).to.equal('/test');
                }
              },
            },
          ],
          [
            'function-url',
            {
              hooks: {
                afterCreate: async function self(testConfig) {
                  await awsRequest(Lambda, 'createAlias', {
                    FunctionName: testConfig.configuration.FunctionName,
                    FunctionVersion: '$LATEST',
                    Name: 'url',
                  });
                  const deferredFunctionUrl = (async () => {
                    try {
                      return (
                        await awsRequest(Lambda, 'createFunctionUrlConfig', {
                          AuthType: 'NONE',
                          FunctionName: testConfig.configuration.FunctionName,
                          Qualifier: 'url',
                        })
                      ).FunctionUrl;
                    } catch (error) {
                      if (
                        error.message.includes('FunctionUrlConfig exists for this Lambda function')
                      ) {
                        return (
                          await awsRequest(Lambda, 'getFunctionUrlConfig', {
                            FunctionName: testConfig.configuration.FunctionName,
                            Qualifier: 'url',
                          })
                        ).FunctionUrl;
                      }
                      throw error;
                    }
                  })();
                  await Promise.all([
                    deferredFunctionUrl,
                    awsRequest(Lambda, 'addPermission', {
                      FunctionName: testConfig.configuration.FunctionName,
                      Qualifier: 'url',
                      FunctionUrlAuthType: 'NONE',
                      Principal: '*',
                      Action: 'lambda:InvokeFunctionUrl',
                      StatementId: 'public-function-url',
                    }),
                  ]);
                  testConfig.functionUrl = await deferredFunctionUrl;
                },
                beforeDelete: async (testConfig) => {
                  await awsRequest(Lambda, 'deleteFunctionUrlConfig', {
                    FunctionName: testConfig.configuration.FunctionName,
                    Qualifier: 'url',
                  });
                },
              },
              invoke: async function self(testConfig) {
                const startTime = process.hrtime.bigint();
                const response = await fetch(`${testConfig.functionUrl}/test?foo=bar`, {
                  method: 'POST',
                  body: JSON.stringify({ some: 'content' }),
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });
                if (response.status !== 200) {
                  if (response.status === 404) {
                    await wait(1000);
                    return self(testConfig);
                  }
                  throw new Error(`Unexpected response status: ${response.status}`);
                }
                const payload = { raw: await response.text() };
                const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
                log.debug('invoke response payload %s', payload.raw);
                return { duration, payload };
              },
              test: ({ invocationsData }) => {
                for (const { trace } of invocationsData) {
                  const { tags } = trace.spans[0];

                  expect(tags.aws.lambda.eventSource).to.equal('aws.lambda');
                  expect(tags.aws.lambda.eventType).to.equal('aws.lambda.url');

                  expect(tags.aws.lambda.http).to.have.property('host');
                  expect(tags.aws.lambda.http).to.have.property('requestHeaderNames');
                  expect(tags.aws.lambda.http.method).to.equal('POST');
                  expect(tags.aws.lambda.http.path).to.equal('/test');

                  expect(tags.aws.lambda.http.statusCode.toString()).to.equal('200');
                }
              },
            },
          ],
        ]),
      },
    ],
    [
      'http-requester',
      {
        variants: new Map([
          [
            'http',
            {
              test: ({ invocationsData }) => {
                for (const [
                  index,
                  {
                    trace: { spans },
                  },
                ] of invocationsData.entries()) {
                  spans.shift();
                  if (!index) spans.shift();
                  const [invocationSpan, httpRequestSpan] = spans;

                  expect(httpRequestSpan.name).to.equal('node.http.request');
                  expect(httpRequestSpan.parentSpanId.toString()).to.equal(
                    invocationSpan.id.toString()
                  );

                  const { tags } = httpRequestSpan;
                  expect(tags.http.method).to.equal('GET');
                  expect(tags.http.protocol).to.equal('HTTP/1.1');
                  expect(tags.http.host).to.equal('localhost:3177');
                  expect(tags.http.path).to.equal('/');
                  expect(tags.http.queryParameterNames).to.deep.equal(['foo']);
                  expect(tags.http.requestHeaderNames).to.deep.equal(['someHeader']);
                  expect(tags.http.statusCode.toString()).to.equal('200');
                }
              },
            },
          ],
          [
            'https',
            {
              hooks: {
                afterCreate: async function self(testConfig) {
                  const urlEndpointLambdaName =
                    (testConfig.urlEndpointLambdaName = `${testConfig.configuration.FunctionName}-endpoint`);
                  try {
                    await awsRequest(Lambda, 'createFunction', {
                      FunctionName: urlEndpointLambdaName,
                      Handler: 'api-endpoint.handler',
                      Role: coreConfig.roleArn,
                      Runtime: 'nodejs16.x',
                      Code: {
                        ZipFile: resolveFileZipBuffer(
                          path.resolve(fixturesDirname, 'api-endpoint.js')
                        ),
                      },
                      MemorySize: 1024,
                    });
                  } catch (error) {
                    if (
                      error.message.includes(
                        'The role defined for the function cannot be assumed by Lambda'
                      ) ||
                      error.message.includes('because the KMS key is invalid for CreateGrant')
                    ) {
                      // Occassional race condition issue on AWS side, retry
                      await self(testConfig);
                      return;
                    }
                    if (error.message.includes('Function already exist')) {
                      log.notice(
                        'Function %s already exists, deleting and re-creating',
                        testConfig.name
                      );
                      await awsRequest(Lambda, 'deleteFunction', {
                        FunctionName: urlEndpointLambdaName,
                      });
                      await self(testConfig);
                      return;
                    }
                    throw error;
                  }
                  await awsRequest(Lambda, 'createAlias', {
                    FunctionName: urlEndpointLambdaName,
                    FunctionVersion: '$LATEST',
                    Name: 'url',
                  });
                  const deferredFunctionUrl = (async () => {
                    try {
                      return (
                        await awsRequest(Lambda, 'createFunctionUrlConfig', {
                          AuthType: 'NONE',
                          FunctionName: urlEndpointLambdaName,
                          Qualifier: 'url',
                        })
                      ).FunctionUrl;
                    } catch (error) {
                      if (
                        error.message.includes('FunctionUrlConfig exists for this Lambda function')
                      ) {
                        return (
                          await awsRequest(Lambda, 'getFunctionUrlConfig', {
                            FunctionName: urlEndpointLambdaName,
                            Qualifier: 'url',
                          })
                        ).FunctionUrl;
                      }
                      throw error;
                    }
                  })();
                  await Promise.all([
                    deferredFunctionUrl,
                    awsRequest(Lambda, 'addPermission', {
                      FunctionName: urlEndpointLambdaName,
                      Qualifier: 'url',
                      FunctionUrlAuthType: 'NONE',
                      Principal: '*',
                      Action: 'lambda:InvokeFunctionUrl',
                      StatementId: 'public-function-url',
                    }),
                  ]);
                  testConfig.functionUrl = await deferredFunctionUrl;
                  let state;
                  do {
                    await wait(100);
                    ({
                      Configuration: { State: state },
                    } = await awsRequest(Lambda, 'getFunction', {
                      FunctionName: urlEndpointLambdaName,
                    }));
                  } while (state !== 'Active');
                },
                beforeDelete: async (testConfig) => {
                  await Promise.all([
                    awsRequest(Lambda, 'deleteFunctionUrlConfig', {
                      FunctionName: testConfig.urlEndpointLambdaName,
                      Qualifier: 'url',
                    }),
                    awsRequest(Lambda, 'deleteFunction', {
                      FunctionName: testConfig.urlEndpointLambdaName,
                    }),
                  ]);
                },
              },
              invokePayload: (testConfig) => {
                return { url: `${testConfig.functionUrl}?foo=bar` };
              },
              test: ({ invocationsData, testConfig: { functionUrl } }) => {
                for (const [
                  index,
                  {
                    trace: { spans },
                  },
                ] of invocationsData.entries()) {
                  spans.shift();
                  if (!index) spans.shift();
                  const [invocationSpan, httpRequestSpan] = spans;

                  expect(httpRequestSpan.name).to.equal('node.https.request');
                  expect(httpRequestSpan.parentSpanId.toString()).to.equal(
                    invocationSpan.id.toString()
                  );

                  const { tags } = httpRequestSpan;
                  expect(tags.http.method).to.equal('GET');
                  expect(tags.http.protocol).to.equal('HTTP/1.1');
                  expect(tags.http.host).to.equal(functionUrl.slice('https://'.length, -1));
                  expect(tags.http.path).to.equal('/');
                  expect(tags.http.queryParameterNames).to.deep.equal(['foo']);
                  expect(tags.http.statusCode.toString()).to.equal('200');
                }
              },
            },
          ],
        ]),
      },
    ],
    [
      'aws-sdk-v2',
      {
        config: { test: testAwsSdk },
        variants: new Map([
          [
            'internal',
            {
              configuration: {
                Runtime: 'nodejs16.x',
                Code: {
                  ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'aws-sdk-v2.js')),
                },
              },
            },
          ],
          ['external', {}],
        ]),
      },
    ],
    [
      'aws-sdk-v3',
      {
        config: { test: testAwsSdk },
        variants: new Map([
          [
            'internal',
            {
              configuration: {
                Code: {
                  ZipFile: resolveFileZipBuffer(path.resolve(fixturesDirname, 'aws-sdk-v3.js')),
                },
              },
            },
          ],
          ['external', { configuration: { Runtime: 'nodejs16.x' } }],
        ]),
      },
    ],
    [
      'aws-sdk-v2-doubled-resolution',
      {
        test: ({ invocationsData }) => {
          for (const [
            index,
            {
              trace: { spans },
            },
          ] of invocationsData.entries()) {
            spans.shift();
            if (!index) spans.shift();
            spans.shift();
            expect(spans.map(({ name }) => name)).to.deep.equal([
              'aws.sdk.lambda.listfunctions',
              'aws.sdk.lambda.listfunctions',
            ]);
          }
        },
      },
    ],
    [
      'express',
      {
        hooks: {
          afterCreate: getCreateHttpApi('2.0'),
          beforeDelete: async (testConfig) => {
            await awsRequest(ApiGatewayV2, 'deleteApi', { ApiId: testConfig.apiId });
          },
        },
        invoke: async function self(testConfig) {
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
            if (response.status === 404) {
              await wait(1000);
              return self(testConfig);
            }
            throw new Error(`Unexpected response status: ${response.status}`);
          }
          const payload = { raw: await response.text() };
          const duration = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
          log.debug('invoke response payload %s', payload.raw);
          return { duration, payload };
        },
        test: ({ invocationsData, testConfig }) => {
          for (const [
            index,
            {
              trace: { spans },
            },
          ] of invocationsData.entries()) {
            const lambdaSpan = spans.shift();
            if (!index) spans.shift();
            const { tags: lambdaTags } = lambdaSpan;

            expect(lambdaTags.aws.lambda.eventSource).to.equal('aws.apigateway');
            expect(lambdaTags.aws.lambda.eventType).to.equal('aws.apigatewayv2.http.v2');

            expect(lambdaTags.aws.lambda.apiGateway).to.have.property('accountId');
            expect(lambdaTags.aws.lambda.apiGateway.apiId).to.equal(testConfig.apiId);
            expect(lambdaTags.aws.lambda.apiGateway.apiStage).to.equal('$default');
            expect(lambdaTags.aws.lambda.apiGateway.request).to.have.property('id');
            expect(lambdaTags.aws.lambda.apiGateway.request).to.have.property('timeEpoch');
            expect(lambdaTags.aws.lambda.http).to.have.property('host');
            expect(lambdaTags.aws.lambda.http).to.have.property('requestHeaderNames');
            expect(lambdaTags.aws.lambda.http.method).to.equal('POST');
            expect(lambdaTags.aws.lambda.http.path).to.equal('/test');

            expect(lambdaTags.aws.lambda.http.statusCode.toString()).to.equal('200');

            expect(lambdaTags.aws.lambda.httpRouter.path.toString()).to.equal('/test');

            const [invocationSpan, expressSpan, ...middlewareSpans] = spans;
            const routeSpan = middlewareSpans.pop();
            const routerSpan = middlewareSpans[middlewareSpans.length - 1];

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
            expect(routeSpan.name).to.equal('express.middleware.route.post.anonymous');
            expect(String(routeSpan.parentSpanId)).to.equal(String(routerSpan.id));
          }
        },
      },
    ],
    [
      'multi-async',
      {
        variants: new Map([
          [
            'v12',
            {
              config: { configuration: { Runtime: 'nodejs12.x' } },
              variants: new Map([
                ['dev-mode', devModeConfiguration],
                ['regular', {}],
              ]),
            },
          ],
          [
            'v14',
            {
              config: { configuration: { Runtime: 'nodejs14.x' } },
              variants: new Map([
                ['dev-mode', devModeConfiguration],
                ['regular', {}],
              ]),
            },
          ],
          [
            'v16',
            {
              config: { configuration: { Runtime: 'nodejs16.x' } },
              variants: new Map([
                ['dev-mode', devModeConfiguration],
                ['regular', {}],
              ]),
            },
          ],
          [
            'v18',
            {
              config: { configuration: { Runtime: 'nodejs18.x' } },
              variants: new Map([
                ['dev-mode', devModeConfiguration],
                ['regular', {}],
              ]),
            },
          ],
        ]),
        config: {
          test: ({ invocationsData }) => {
            for (const [
              index,
              {
                trace: { spans },
              },
            ] of invocationsData.entries()) {
              const lambdaSpan = spans.shift();
              if (!index) spans.shift();

              const [invocationSpan, expressSpan, ...otherSpans] = spans;
              const middlewareSpans = otherSpans.slice(0, -4);
              const routeSpan = middlewareSpans.pop();
              const routerSpan = middlewareSpans[middlewareSpans.length - 1];
              const expressRequest1Span = otherSpans[otherSpans.length - 4];
              const expressRequest2Span = otherSpans[otherSpans.length - 3];
              const outerRequest1Span = otherSpans[otherSpans.length - 2];
              const outerRequest2Span = otherSpans[otherSpans.length - 1];

              expect(expressSpan.parentSpanId).to.deep.equal(invocationSpan.id);

              expect(lambdaSpan.tags.aws.lambda.httpRouter.path).to.equal('/foo');

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
            }
          },
        },
      },
    ],
    [
      'callback-no-result',
      {
        variants: new Map([
          ['v12', { config: { configuration: { Runtime: 'nodejs12.x' } } }],
          ['v14', { config: { configuration: { Runtime: 'nodejs14.x' } } }],
          ['v16', { config: { configuration: { Runtime: 'nodejs16.x' } } }],
          ['v18', { config: { configuration: { Runtime: 'nodejs18.x' } } }],
        ]),
        config: Object.assign({
          isCustomResponse: true,
          devModeConfiguration,
        }),
      },
    ],
    [
      'delayed-http-request',
      {
        variants: new Map([
          ['v12', { config: { configuration: { Runtime: 'nodejs12.x' } } }],
          ['v14', { config: { configuration: { Runtime: 'nodejs14.x' } } }],
          ['v16', { config: { configuration: { Runtime: 'nodejs16.x' } } }],
          ['v18', { config: { configuration: { Runtime: 'nodejs18.x' } } }],
        ]),
        config: {
          test: ({ invocationsData }) => {
            expect(invocationsData[1].trace.spans.map(({ name }) => name)).to.deep.equal([
              'aws.lambda',
              'node.http.request',
              'aws.lambda.invocation',
            ]);
          },
          hasOrphanedSpans: true,
        },
      },
    ],
    [
      'sdk',
      {
        variants: new Map([
          ['v12', { configuration: { Runtime: 'nodejs12.x' } }],
          ['v14', { configuration: { Runtime: 'nodejs14.x' } }],
          ['v16', { configuration: { Runtime: 'nodejs16.x' } }],
          ['v18', { configuration: { Runtime: 'nodejs18.x' } }],
        ]),
        config: {
          isCustomResponse: true,
          test: ({ invocationsData }) => {
            for (const [index, { trace, responsePayload }] of invocationsData.entries()) {
              const { spans, events, customTags } = trace;
              let awsLambdaInvocationSpan;
              if (index === 0) {
                awsLambdaInvocationSpan = spans[2];
                expect(spans.map(({ name }) => name)).to.deep.equal([
                  'aws.lambda',
                  'aws.lambda.initialization',
                  'aws.lambda.invocation',
                  'user.span',
                ]);
              } else {
                awsLambdaInvocationSpan = spans[1];
                expect(spans.map(({ name }) => name)).to.deep.equal([
                  'aws.lambda',
                  'aws.lambda.invocation',
                  'user.span',
                ]);
              }
              const payload = JSON.parse(responsePayload.raw);
              expect(payload.name).to.equal(pkgJson.name);
              expect(payload.version).to.equal(pkgJson.version);
              expect(payload.rootSpanName).to.equal('aws.lambda');
              expect(JSON.parse(customTags)).to.deep.equal({ 'user.tag': `example:${index + 1}` });

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
              expect(events.map(normalizeEvent)).to.deep.equal([
                {
                  traceId: awsLambdaInvocationSpan.traceId,
                  spanId: awsLambdaInvocationSpan.id,
                  eventName: 'telemetry.error.generated.v1',
                  customTags: JSON.stringify({ 'user.tag': 'example', 'invocationid': index + 1 }),
                  tags: {
                    error: {
                      name: 'Error',
                      message: 'Captured error',
                      type: 2,
                    },
                  },
                },
                {
                  traceId: awsLambdaInvocationSpan.traceId,
                  spanId: awsLambdaInvocationSpan.id,
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
                  traceId: awsLambdaInvocationSpan.traceId,
                  spanId: awsLambdaInvocationSpan.id,
                  eventName: 'telemetry.warning.generated.v1',
                  customTags: JSON.stringify({ 'user.tag': 'example', 'invocationid': index + 1 }),
                  tags: {
                    warning: {
                      message: 'Captured warning',
                      type: 1,
                    },
                  },
                },
                {
                  traceId: awsLambdaInvocationSpan.traceId,
                  spanId: awsLambdaInvocationSpan.id,
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
      fixturesDirname,
      baseLambdaConfiguration: {
        Runtime: 'nodejs18.x',
        Layers: [coreConfig.layerInternalArn],
        Environment: {
          Variables: {
            AWS_LAMBDA_EXEC_WRAPPER: '/opt/sls-sdk-node/exec-wrapper.sh',
          },
        },
      },
    });

    for (const testConfig of testVariantsConfig) {
      testConfig.deferredResult = processFunction(testConfig, coreConfig).catch((error) => ({
        // As we process result promises sequentially step by step in next turn, allowing them to
        // reject will generate unhandled rejection.
        // Therefore this scenario is converted to successuful { error } resolution
        error,
      }));
    }
  });

  const resolveOutcomeEnumValue = (value) => {
    switch (value) {
      case 'success':
        return 1;
      case 'error:handled':
        return 5;
      case 'error:unhandled':
        return 3;
      default:
        throw new Error(`Unexpected outcome value: ${value}`);
    }
  };

  for (const testConfig of testVariantsConfig) {
    it(testConfig.name, async () => {
      const testResult = await testConfig.deferredResult;
      if (testResult.error) throw testResult.error;
      log.debug('%s test result: %o', testConfig.name, testResult);
      const { expectedOutcome } = testConfig;
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
        for (const [
          index,
          {
            trace: { spans, slsTags, events },
          },
        ] of invocationsData.entries()) {
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
          } else {
            if (!testConfig.hasOrphanedSpans) {
              expect(spans.map(({ name }) => name).slice(0, 2)).to.deep.equal([
                'aws.lambda',
                'aws.lambda.invocation',
              ]);
            }
            expect(lambdaSpan.tags.aws.lambda.isColdstart).to.be.false;
            const [, invocationSpan] = spans;
            expect(String(invocationSpan.parentSpanId)).to.equal(String(lambdaSpan.id));
          }
          expect(slsTags).to.deep.equal({
            orgId: process.env.SLS_ORG_ID,
            service: testConfig.configuration.FunctionName,
            sdk: { name: pkgJson.name, version: pkgJson.version },
          });
          expect(lambdaSpan.tags.aws.lambda).to.have.property('arch');
          expect(lambdaSpan.tags.aws.lambda.name).to.equal(testConfig.configuration.FunctionName);
          expect(lambdaSpan.tags.aws.lambda).to.have.property('requestId');
          expect(lambdaSpan.tags.aws.lambda).to.have.property('version');
          expect(lambdaSpan.tags.aws.lambda.outcome).to.equal(
            resolveOutcomeEnumValue(expectedOutcome)
          );
          if (expectedOutcome !== 'success') {
            const errorTags = events.find(
              (event) => event.tags.error && event.tags.error.type === 1
            ).tags.error;
            expect(typeof errorTags.message).to.equal('string');
            expect(typeof errorTags.stacktrace).to.equal('string');
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
