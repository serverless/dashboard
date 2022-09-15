'use strict';

// eslint-disable-next-line import/no-unresolved
const { SQS, SNS, DynamoDB } = require('aws-sdk');

const wait = require('timers-ext/promise/sleep');

const sqs = new SQS();
const sns = new SNS();
const dynamoDb = new DynamoDB();

let invocationCount = 0;

module.exports.handler = async () => {
  try {
    ++invocationCount;

    // SQS
    const queueName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}.fifo`;
    const { QueueUrl: queueUrl } = await sqs
      .createQueue({ QueueName: queueName, Attributes: { FifoQueue: 'true' } })
      .promise();
    await sqs
      .sendMessage({
        QueueUrl: queueUrl,
        MessageBody: 'test',
        MessageGroupId: String(Date.now()),
        MessageDeduplicationId: String(Date.now()),
      })
      .promise();
    await sqs.deleteQueue({ QueueUrl: queueUrl }).promise();

    // SNS
    const topicName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}`;
    const { TopicArn: topicArn } = await sns.createTopic({ Name: topicName }).promise();
    await sns.publish({ TopicArn: topicArn, Message: 'test' }).promise();
    await sns.deleteTopic({ TopicArn: topicArn }).promise();

    // DynamoDB
    const tableName = `${process.env.AWS_LAMBDA_FUNCTION_NAME}-${invocationCount}`;
    await dynamoDb
      .createTable({
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
      })
      .promise();
    let status;
    do {
      await wait(100);
      status = (await dynamoDb.describeTable({ TableName: tableName }).promise()).Table.TableStatus;
    } while (status !== 'ACTIVE');
    await dynamoDb.putItem({ TableName: tableName, Item: { id: { S: 'test' } } }).promise();
    await dynamoDb
      .query({
        TableName: tableName,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':id': { S: 'test' } },
      })
      .promise();
    await dynamoDb.deleteTable({ TableName: tableName }).promise();

    return 'ok';
  } catch (error) {
    console.log(error);
    throw error;
  }
};
