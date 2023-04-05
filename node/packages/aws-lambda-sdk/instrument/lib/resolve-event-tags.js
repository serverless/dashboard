'use strict';

const isObject = require('type/object/is');

const awsLambdaSpan = require('./sdk').traceSpans.awsLambda;

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

const albEventMap = [
  'path',
  'httpMethod',
  'headers',
  'queryStringParameters',
  ['requestContext', ['elb']],
  'body',
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
        event_source: 'aws.apigateway',
        event_type: event.version ? 'aws.apigatewayv2.http.v1' : 'aws.apigateway.rest',
      },
      { prefix: 'aws.lambda' }
    );
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
        path_parameter_names: Object.keys(event.pathParameters || {}),
      },
      { prefix: 'aws.lambda.api_gateway.request' }
    );
    awsLambdaSpan.tags.setMany(
      {
        method: requestContext.httpMethod,
        protocol: requestContext.protocol,
        host: requestContext.domainName,
        path: requestContext.path,
        query_parameter_names: Object.keys(event.queryStringParameters || {}),
        request_header_names: Object.keys(event.headers || {}),
      },
      { prefix: 'aws.lambda.http' }
    );
    awsLambdaSpan.tags.set('aws.lambda.http_router.path', requestContext.resourcePath);
    return;
  }
  if (doesObjectMatchMap(event, httpApiV2EventMap)) {
    // API Gateway v2 HTTP API (v2 payload) or Lambda URL event
    const { requestContext } = event;
    const eventSource = requestContext.domainName.includes('.lambda-url.')
      ? 'lambdaUrl'
      : 'httpApi';
    if (eventSource === 'lambdaUrl') {
      awsLambdaSpan.tags.setMany(
        { event_source: 'aws.lambda', event_type: 'aws.lambda.url' },
        { prefix: 'aws.lambda' }
      );
    } else {
      awsLambdaSpan.tags.setMany(
        { event_source: 'aws.apigateway', event_type: 'aws.apigatewayv2.http.v2' },
        { prefix: 'aws.lambda' }
      );
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
          path_parameter_names: Object.keys(event.pathParameters || {}),
        },
        { prefix: 'aws.lambda.api_gateway.request' }
      );
      awsLambdaSpan.tags.set(
        'aws.lambda.http_router.path',
        event.routeKey === '$default'
          ? '$default'
          : event.routeKey.slice(event.routeKey.indexOf(' ') + 1)
      );
    }
    awsLambdaSpan.tags.setMany(
      {
        method: requestContext.http.method,
        protocol: requestContext.http.protocol,
        host: requestContext.domainName,
        path: requestContext.http.path,
        query_parameter_names: Object.keys(event.queryStringParameters || {}),
        request_header_names: Object.keys(event.headers || {}),
      },
      { prefix: 'aws.lambda.http' }
    );
    return;
  }
  if (doesObjectMatchMap(event, albEventMap)) {
    // Application Load Balancer event
    awsLambdaSpan.tags.setMany(
      {
        event_source: 'aws.elasticloadbalancing',
        event_type: 'aws.elasticloadbalancing.http',
      },
      { prefix: 'aws.lambda' }
    );
    awsLambdaSpan.tags.setMany(
      {
        method: event.httpMethod,
        protocol: 'http', // Not provided by ALB, yet required property
        host: 'unknown', // Not provided by ALB, yet required property
        path: event.path,
        query_parameter_names: Object.keys(event.queryStringParameters || {}),
        request_header_names: Object.keys(event.headers || {}),
      },
      { prefix: 'aws.lambda.http' }
    );
    awsLambdaSpan.tags.set('aws.lambda.http_router.path', event.path);
    return;
  }

  if (doesObjectMatchMap(event, sqsEventMap)) {
    // SQS Queue event
    const queueArn = event.Records[0].eventSourceARN;
    awsLambdaSpan.tags.setMany(
      { event_source: 'aws.sqs', event_type: 'aws.sqs' },
      { prefix: 'aws.lambda' }
    );
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
      { event_source: 'aws.sns', event_type: 'aws.sns' },
      { prefix: 'aws.lambda' }
    );
    awsLambdaSpan.tags.setMany(
      {
        topic_name: topicArn.slice(topicArn.lastIndexOf(':') + 1),
        message_ids: event.Records.map(({ Sns: { MessageId: messageId } }) => messageId),
      },
      { prefix: 'aws.lambda.sns' }
    );
  }
};
