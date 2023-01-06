'use strict';

const dynamodbConfig = {
  params: (
    traceSpan,
    {
      TableName: tableName,
      GlobalTableName: globalTableName,
      ConsistentRead: consistentRead,
      Limit: limit,
      AttributesToGet: attributesToGet,
      ProjectionExpression: projectionExpression,
      IndexName: indexName,
      ScanIndexForward: scanIndexForward,
      Select: select,
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpression,
      Segment: segment,
      TotalSegments: totalSegments,
      ExclusiveStartKey: exclusiveStartKey,
    }
  ) => {
    const tags = {};
    if (tableName) tags.table_name = tableName;
    else if (globalTableName) tags.table_name = globalTableName;
    if (consistentRead) tags.consistent_read = consistentRead;
    if (limit) tags.limit = limit;
    tags.attributes_to_get = attributesToGet || [];
    if (projectionExpression) tags.projection = projectionExpression;
    if (indexName) tags.index_name = indexName;
    if (scanIndexForward) tags.scan_forward = scanIndexForward;
    if (select) tags.select = select;
    if (filterExpression) tags.filter = filterExpression;
    if (keyConditionExpression) tags.key_condition = keyConditionExpression;
    if (segment) tags.segment = segment;
    if (totalSegments) tags.total_segments = totalSegments;
    if (exclusiveStartKey) tags.exclusive_start_key = JSON.stringify(exclusiveStartKey);
    traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.dynamodb' });
  },
  responseData: (traceSpan, { Count: count, ScannedCount: scannedCount }) => {
    const tags = {};
    if (count) tags.count = count;
    if (scannedCount) tags.scanned_count = scannedCount;
    traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.dynamodb' });
  },
};

module.exports = new Map([
  [
    'sns',
    {
      params: (traceSpan, { TopicArn: topicArn }) => {
        const tags = { message_ids: [] };
        if (topicArn) tags.topic_name = topicArn.slice(topicArn.lastIndexOf(':') + 1);
        traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.sns' });
      },
      responseData: (
        traceSpan,
        { TopicArn: topicArn, MessageId: messageId, Successful: messages }
      ) => {
        traceSpan.tags.delete('aws.sdk.sns.message_ids');
        const tags = {};
        if (topicArn) tags.topic_name = topicArn.slice(topicArn.lastIndexOf(':') + 1);
        if (messageId) tags.message_ids = [messageId];
        else if (messages) tags.message_ids = messages.map(({ MessageId: id }) => id);
        else tags.message_ids = [];
        traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.sns' });
      },
    },
  ],
  [
    'sqs',
    {
      params: (traceSpan, { QueueUrl: queueUrl, QueueName: queueName }) => {
        const tags = { message_ids: [] };
        if (queueUrl) tags.queue_name = queueUrl.slice(queueUrl.lastIndexOf('/') + 1);
        else if (queueName) tags.queue_name = queueName;
        traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.sqs' });
      },
      responseData: (
        traceSpan,
        {
          QueueUrl: queueUrl,
          MessageId: messageId,
          Successful: successfulMessages,
          Messages: messages,
        }
      ) => {
        traceSpan.tags.delete('aws.sdk.sqs.message_ids');
        const tags = {};
        if (queueUrl) tags.queue_name = queueUrl.slice(queueUrl.lastIndexOf('/') + 1);
        if (messageId) {
          tags.message_ids = [messageId];
        } else if (successfulMessages || messages) {
          tags.message_ids = (successfulMessages || messages)
            .map(({ MessageId: id }) => id)
            .filter(Boolean);
        } else {
          tags.message_ids = [];
        }
        traceSpan.tags.setMany(tags, { prefix: 'aws.sdk.sqs' });
      },
    },
  ],
  ['dynamodb', dynamodbConfig],
  ['dynamodbdocument', dynamodbConfig],
]);
