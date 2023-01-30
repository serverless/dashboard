'use strict';

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SQS } = require('@aws-sdk/client-sqs');
const { SNS } = require('@aws-sdk/client-sns');
const { STS } = require('@aws-sdk/client-sts');
const { Lambda } = require('@aws-sdk/client-lambda');
const { DynamoDB, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamodbClient = new DynamoDBClient({});
const dynamodbDocumentClient = DynamoDBDocumentClient.from(dynamodbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const wait = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const s3Client = new S3Client();
const sqs = new SQS();
const sns = new SNS();
const lambda = new Lambda();
const dynamoDb = new DynamoDB();
const sts = new STS();

let invocationCount = 0;

module.exports.handler = async () => {
  try {
    ++invocationCount;

    // STS (confirm on tracing of any AWS service)
    await sts.getCallerIdentity();

    // getSignedUrl won't issue a real HTTP request
    // It's injected to confirm no trace span will be created for it
    await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: 'test', Key: 'test' }), {
      expiresIn: 3600,
    });

    // Test request error reporting
    try {
      await lambda.getFunction({ FunctionName: 'not-existing' });
    } catch (error) {
      // do nothing
    }

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
    await dynamodbDocumentClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':id': 'test' },
      })
    );
    await dynamoDb.deleteTable({ TableName: tableName });

    return 'ok';
  } catch (error) {
    console.log(error);
    throw error;
  }
};
