'use strict';

const { SQS } = require('@aws-sdk/client-sqs');
const { SNS } = require('@aws-sdk/client-sns');
const { STS } = require('@aws-sdk/client-sts');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const wait = require('timers-ext/promise/sleep');

const sqs = new SQS();
const sns = new SNS();
const dynamoDb = new DynamoDB();
const sts = new STS();

let invocationCount = 0;

module.exports.handler = async () => {
  try {
    ++invocationCount;

    // STS (any service tracing
    await sts.getCallerIdentity();

    // SQS
    const queueName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}.fifo`;
    const { QueueUrl: queueUrl } = await sqs.createQueue({
      QueueName: queueName,
      Attributes: { FifoQueue: 'true' },
    });
    await sqs.sendMessage({
      QueueUrl: queueUrl,
      MessageBody: 'test',
      MessageGroupId: String(Date.now()),
      MessageDeduplicationId: String(Date.now()),
    });
    await sqs.deleteQueue({ QueueUrl: queueUrl });

    // SNS
    const topicName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}`;
    const { TopicArn: topicArn } = await sns.createTopic({ Name: topicName });
    await sns.publish({ TopicArn: topicArn, Message: 'test' });
    await sns.deleteTopic({ TopicArn: topicArn });

    // DynamoDB
    const tableName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}`;
    await dynamoDb.createTable({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
    let status;
    do {
      await wait(100);
      status = (await dynamoDb.describeTable({ TableName: tableName })).Table.TableStatus;
    } while (status !== 'ACTIVE');
    await dynamoDb.putItem({ TableName: tableName, Item: { id: { S: 'test' } } });
    await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: { '#id': 'id' },
      ExpressionAttributeValues: { ':id': { S: 'test' } },
    });
    await dynamoDb.deleteTable({ TableName: tableName });

    return 'ok';
  } catch (error) {
    console.log(error);
    throw error;
  }
};
