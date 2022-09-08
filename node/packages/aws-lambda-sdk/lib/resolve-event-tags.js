'use strict';

const isObject = require('type/object/is');

const awsLambdaSpan = (global.serverlessSdk || require('../')).traceSpans.awsLambda;

const objHasOwnProperty = Object.prototype.hasOwnProperty;

const doesObjectMatchMap = (object, map) =>
  map.every((key) => {
    if (Array.isArray(key)) {
      if (!objHasOwnProperty.call(object, key[0])) return false;
      if (!isObject(object[key[0]])) return false;
      return doesObjectMatchMap(object[key[0]], key[1]);
    }
    return objHasOwnProperty.call(object, key);
  });

const resolveParametersJson = (multiValueParameters) => {
  if (!multiValueParameters) return null;
  const result = {};
  for (const [name, values] of Object.entries(multiValueParameters)) {
    result[name] = values.length > 1 ? values : values[0];
  }
  return JSON.stringify(result);
};

const resolveQueryString = (queryParameters) => {
  if (!queryParameters) return null;
  const params = new URLSearchParams();
  for (const [name, values] of Object.entries(queryParameters)) {
    if (!Array.isArray(values)) {
      params.append(name, values);
      continue;
    }
    for (const value of values) params.append(name, value);
  }
  return params.toString();
};

const apiGatewayEventMap = [
  'resource',
  'path',
  'httpMethod',
  'headers',
  'multiValueHeaders',
  'queryStringParameters',
  'multiValueQueryStringParameters',
  [
    'requestContext',
    [
      'accountId',
      'apiId',
      'domainName',
      'domainPrefix',
      'extendedRequestId',
      'httpMethod',
      [
        'identity',
        [
          'cognitoIdentityPoolId',
          'cognitoIdentityId',
          'principalOrgId',
          'cognitoAuthenticationType',
          'userArn',
          'userAgent',
          'accountId',
          'caller',
          'sourceIp',
          'accessKey',
          'cognitoAuthenticationProvider',
          'user',
        ],
      ],
      'path',
      'protocol',
      'requestId',
      'requestTime',
      'requestTimeEpoch',
      'resourceId',
      'resourcePath',
      'stage',
    ],
  ],
  'pathParameters',
  'stageVariables',
  'body',
  'isBase64Encoded',
];

const httpApiV2EventMap = [
  'version',
  'routeKey',
  'rawPath',
  'rawQueryString',
  'headers',
  [
    'requestContext',
    [
      'accountId',
      'apiId',
      'domainName',
      'domainPrefix',
      ['http', ['method', 'path', 'protocol', 'sourceIp', 'userAgent']],
      'requestId',
      'routeKey',
      'stage',
      'time',
      'timeEpoch',
    ],
  ],
  'isBase64Encoded',
];

const sqsEventMap = [
  [
    'Records',
    [
      [
        '0',
        [
          'messageId',
          'receiptHandle',
          'body',
          [
            'attributes',
            [
              'ApproximateReceiveCount',
              'SentTimestamp',
              'SenderId',
              'ApproximateFirstReceiveTimestamp',
            ],
          ],
          'messageAttributes',
          'md5OfBody',
          'eventSource',
          'eventSourceARN',
          'awsRegion',
        ],
      ],
    ],
  ],
];

const snsEventMap = [
  [
    'Records',
    [
      [
        '0',
        [
          'EventVersion',
          'EventSubscriptionArn',
          'EventSource',
          [
            'Sns',
            [
              'SignatureVersion',
              'Timestamp',
              'Signature',
              'SigningCertUrl',
              'MessageId',
              'Message',
              'MessageAttributes',
              'Type',
              'UnsubscribeUrl',
              'TopicArn',
              'Subject',
            ],
          ],
        ],
      ],
    ],
  ],
];

module.exports = (event) => {
  if (!isObject(event)) return;
  if (doesObjectMatchMap(event, apiGatewayEventMap)) {
    // API Gateway v1 REST API or v2 HTTP API (v1 payload) event
    const { requestContext } = event;
    awsLambdaSpan.tags.setMany(
      {
        account_id: requestContext.accountId,
        api_id: requestContext.apiId,
        api_stage: requestContext.stage,
      },
      { prefix: 'aws.lambda.api_gateway' }
    );
    awsLambdaSpan.tags.setMany(
      {
        id: requestContext.requestId,
        time_epoch: requestContext.requestTimeEpoch,
        headers: resolveParametersJson(event.multiValueHeaders) || '{}',
        path_parameters: event.pathParameters ? JSON.stringify(event.pathParameters) : null,
      },
      { prefix: 'aws.lambda.api_gateway.request' }
    );
    awsLambdaSpan.tags.setMany(
      {
        method: requestContext.httpMethod,
        protocol: requestContext.protocol,
        host: requestContext.domainName,
        path: requestContext.path,
        query: resolveQueryString(event.multiValueQueryStringParameters),
      },
      { prefix: 'aws.lambda.http' }
    );
    return;
  }
  if (doesObjectMatchMap(event, httpApiV2EventMap)) {
    // API Gateway v2 HTTP API (v2 payload) event
    const { requestContext } = event;
    awsLambdaSpan.tags.setMany(
      {
        account_id: requestContext.accountId,
        api_id: requestContext.apiId,
        api_stage: requestContext.stage,
      },
      { prefix: 'aws.lambda.api_gateway' }
    );
    awsLambdaSpan.tags.setMany(
      {
        id: requestContext.requestId,
        time_epoch: requestContext.timeEpoch,
        headers: JSON.stringify(event.headers || {}),
        path_parameters: event.pathParameters ? JSON.stringify(event.pathParameters) : null,
      },
      { prefix: 'aws.lambda.api_gateway.request' }
    );
    awsLambdaSpan.tags.setMany(
      {
        method: requestContext.http.method,
        protocol: requestContext.http.protocol,
        host: requestContext.domainName,
        path: requestContext.http.path,
        query: resolveQueryString(event.queryStringParameters),
      },
      { prefix: 'aws.lambda.http' }
    );
    return;
  }

  if (doesObjectMatchMap(event, sqsEventMap)) {
    // SQS Queue event
    const queueArn = event.Records[0].eventSourceARN;
    awsLambdaSpan.tags.setMany(
      {
        queue_name: queueArn.slice(queueArn.lastIndexOf(':') + 1),
        message_ids: event.Records.map(({ messageId }) => messageId),
      },
      { prefix: 'aws.lambda.sqs' }
    );
  }

  if (doesObjectMatchMap(event, snsEventMap)) {
    // SNS message
    const topicArn = event.Records[0].Sns.TopicArn;
    awsLambdaSpan.tags.setMany(
      {
        topic_name: topicArn.slice(topicArn.lastIndexOf(':') + 1),
        message_ids: event.Records.map(({ Sns: { MessageId: messageId } }) => messageId),
      },
      { prefix: 'aws.lambda.sns' }
    );
  }
};
