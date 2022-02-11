'use strict';

const { detectEventType } = require('.');

describe('detectEventType', () => {
  it('should return alexa skill', () => {
    const event = {
      session: {
        attributes: {
          fake: true,
        },
        user: 'fakeUser',
      },
      context: {
        System: 'fakeSystem',
      },
      request: {
        requestId: 'fakeRequestId',
      },
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.alexaskill');
  });

  it('should return custom authorizer', () => {
    const event = {
      methodArn: 'fakeArn',
      type: 'TOKEN',
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.apigateway.authorizer');
  });

  it('should return api gateway v1', () => {
    const event = {
      path: '/something',
      headers: {
        fake: 'header',
      },
      requestContext: {
        fake: 'Context',
      },
      resource: 'fakeResource',
      httpMethod: 'fakeMethod',
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.apigateway.http');
  });

  it('should return api gateway v2', () => {
    const event = {
      rawPath: '/something',
      headers: {
        fake: 'header',
      },
      requestContext: {
        fake: 'Context',
      },
      routeKey: 'routeKey',
      version: '2.0',
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.apigatewayv2.http');
  });

  it('should return cloud front', () => {
    const event = {
      Records: [
        {
          cf: true,
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.cloudfront');
  });

  it('should return cloudwatch event', () => {
    const event = {
      awslogs: {
        data: 'fakeData',
      },
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.cloudwatch.log');
  });

  it('should return firehose event', () => {
    const event = {
      deliveryStreamArn: 'fakeArn',
      records: [
        {
          kinesisRecordMetadata: {
            fake: 'metadata',
          },
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.firehose');
  });

  it('should return kinesis event', () => {
    const event = {
      deliveryStreamArn: 'fakeArn',
      Records: [
        {
          eventSource: 'aws:kinesis',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.kinesis');
  });

  it('should return s3 event', () => {
    const event = {
      Records: [
        {
          eventSource: 'aws:s3',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.s3');
  });

  it('should return scheduled event', () => {
    const event = {
      source: 'aws.events',
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.scheduled');
  });

  it('should return ses event', () => {
    const event = {
      Records: [
        {
          eventSource: 'aws:ses',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.ses');
  });

  it('should return sns event', () => {
    const event = {
      Records: [
        {
          EventSource: 'aws:sns',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.sns');
  });

  it('should return sqs event', () => {
    const event = {
      Records: [
        {
          eventSource: 'aws:sqs',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.sqs');
  });

  it('should return dynamodb event', () => {
    const event = {
      Records: [
        {
          eventSource: 'aws:dynamodb',
        },
      ],
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.dynamodb');
  });

  it('should return cloudwatch event', () => {
    const event = {
      source: 'fakeCWSource',
      detail: 'fakeCWDetail',
    };

    const out = detectEventType(event);
    expect(out).toEqual('aws.cloudwatch.event');
  });

  it('should return null', () => {
    const event = {};

    const out = detectEventType(event);
    expect(out).toEqual(null);
  });
});
