from __future__ import annotations
import pytest
from .. import context
from .serialization import TARGET_LOG_PREFIX, deserialize_trace


@pytest.fixture()
def instrumenter(reset_sdk):
    from serverless_aws_lambda_sdk.instrument import Instrumenter

    return Instrumenter()


def test_handle_api_gateway_rest_api_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.api_endpoint import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "resource": "/some-path/{param}",
        "path": "/some-path/some.-param",
        "httpMethod": "POST",
        "headers": {
            "Accept": "*/*",
            "Accept-Encoding": "gzip,deflate",
            "Other": "Second",
        },
        "multiValueHeaders": {
            "Accept": ["*/*"],
            "Accept-Encoding": ["gzip,deflate"],
            "Other": ["First", "Second"],
        },
        "queryStringParameters": {"foo": "bar", "next": "second"},
        "multiValueQueryStringParameters": {
            "foo": ["bar"],
            "next": ["first", "second"],
        },
        "pathParameters": {"param": "some-param"},
        "stageVariables": None,
        "requestContext": {
            "resourceId": "qrj0an",
            "resourcePath": "/some-path/{param}",
            "httpMethod": "POST",
            "extendedRequestId": "XruZgEKYIAMFauw=",
            "requestTime": "30/Aug/2022:15:20:03 +0000",
            "path": "/test/some-path/some-param",
            "accountId": "205994128558",
            "protocol": "HTTP/1.1",
            "stage": "test",
            "domainPrefix": "xxx",
            "requestTimeEpoch": 1661872803090,
            "requestId": "da6c4e62-62c8-4693-8a4a-d6c4d943ddb4",
            "identity": {
                "cognitoIdentityPoolId": None,
                "accountId": None,
                "cognitoIdentityId": None,
                "caller": None,
                "sourceIp": "80.55.87.22",
                "principalOrgId": None,
                "accessKey": None,
                "cognitoAuthenticationType": None,
                "cognitoAuthenticationProvider": None,
                "userArn": None,
                "userAgent": "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
                "user": None,
            },
            "domainName": "xxx.execute-api.us-east-1.amazonaws.com",
            "apiId": "xxx",
        },
        "body": '"ok"',
        "isBase64Encoded": False,
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.apigateway"
    assert lambda_tags.event_type == "aws.apigateway.rest"

    assert lambda_tags.api_gateway.account_id == "205994128558"
    assert lambda_tags.api_gateway.api_id == "xxx"
    assert lambda_tags.api_gateway.api_stage == "test"

    assert lambda_tags.api_gateway.request.id == "da6c4e62-62c8-4693-8a4a-d6c4d943ddb4"
    assert lambda_tags.api_gateway.request.time_epoch == 1661872803090
    assert lambda_tags.http.protocol == "HTTP/1.1"
    assert lambda_tags.http.host == "xxx.execute-api.us-east-1.amazonaws.com"
    assert lambda_tags.http.request_header_names == [
        "Accept",
        "Accept-Encoding",
        "Other",
    ]

    assert lambda_tags.http.method == "POST"
    assert lambda_tags.http.path == "/test/some-path/some-param"
    assert lambda_tags.api_gateway.request.path_parameter_names == ["param"]
    assert lambda_tags.http.query_parameter_names == ["foo", "next"]

    assert lambda_tags.http.status_code == 200

    assert lambda_tags.http_router.path == "/some-path/{param}"


def test_handle_api_gateway_v2_http_api_payload_v1_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.api_endpoint import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "version": "1.0",
        "resource": "/v1",
        "path": "/v1",
        "httpMethod": "POST",
        "headers": {
            "Content-Length": "385",
            "Content-Type": "multipart/form-data; boundary=--------------------------182902192059219621976732",
            "Multi": "two",
        },
        "multiValueHeaders": {
            "Content-Length": ["385"],
            "Content-Type": [
                "multipart/form-data; boundary=--------------------------182902192059219621976732"
            ],
            "Multi": ["one,stillone", "two"],
        },
        "queryStringParameters": {"lone": "value", "multi": "two"},
        "multiValueQueryStringParameters": {
            "lone": ["value"],
            "multi": ["one,stillone", "two"],
        },
        "requestContext": {
            "accountId": "205994128558",
            "apiId": "xxx",
            "domainName": "xxx.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "xxx",
            "extendedRequestId": "XyGqvi5mIAMEJtw=",
            "httpMethod": "POST",
            "identity": {
                "accessKey": None,
                "accountId": None,
                "caller": None,
                "cognitoAmr": None,
                "cognitoAuthenticationProvider": None,
                "cognitoAuthenticationType": None,
                "cognitoIdentityId": None,
                "cognitoIdentityPoolId": None,
                "principalOrgId": None,
                "sourceIp": "80.55.87.22",
                "user": None,
                "userAgent": "PostmanRuntime/7.29.0",
                "userArn": None,
            },
            "path": "/v1",
            "protocol": "HTTP/1.1",
            "requestId": "XyGqvi5mIAMEJtw=",
            "requestTime": "01/Sep/2022:13:47:10 +0000",
            "requestTimeEpoch": 1662040030156,
            "resourceId": "POST /v1",
            "resourcePath": "/v1",
            "stage": "$default",
        },
        "pathParameters": None,
        "stageVariables": None,
        "body": "LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTE4MjkwMjE5MjA1OTIxOTYyMTk3NjczMg0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0xODI5MDIxOTIwNTkyMTk2MjE5NzY3MzINCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTE4MjkwMjE5MjA1OTIxOTYyMTk3NjczMg0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tMTgyOTAyMTkyMDU5MjE5NjIxOTc2NzMyLS0NCg==",
        "isBase64Encoded": None,
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.apigateway"
    assert lambda_tags.event_type == "aws.apigatewayv2.http.v1"

    assert lambda_tags.api_gateway.account_id == "205994128558"
    assert lambda_tags.api_gateway.api_id == "xxx"
    assert lambda_tags.api_gateway.api_stage == "$default"

    assert lambda_tags.api_gateway.request.id == "XyGqvi5mIAMEJtw="
    assert lambda_tags.api_gateway.request.time_epoch == 1662040030156
    assert lambda_tags.http.protocol == "HTTP/1.1"
    assert lambda_tags.http.host == "xxx.execute-api.us-east-1.amazonaws.com"
    assert lambda_tags.http.request_header_names == [
        "Content-Length",
        "Content-Type",
        "Multi",
    ]

    assert lambda_tags.http.method == "POST"
    assert lambda_tags.http.path == "/v1"
    assert lambda_tags.http.query_parameter_names == ["lone", "multi"]

    assert lambda_tags.http.status_code == 200

    assert lambda_tags.http_router.path == "/v1"


def test_handle_api_gateway_v2_http_api_payload_v2_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.api_endpoint import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "version": "2.0",
        "routeKey": "POST /v2",
        "rawPath": "/v2",
        "rawQueryString": "lone=value&multi=one,stillone&multi=two",
        "headers": {
            "content-length": "385",
            "content-type": "multipart/form-data; boundary=--------------------------419073009317249310175915",
            "multi": "one,stillone,two",
        },
        "queryStringParameters": {"lone": "value", "multi": "one,stillone,two"},
        "requestContext": {
            "accountId": "205994128558",
            "apiId": "xxx",
            "domainName": "xxx.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "xx",
            "http": {
                "method": "POST",
                "path": "/v2",
                "protocol": "HTTP/1.1",
                "sourceIp": "80.55.87.22",
                "userAgent": "PostmanRuntime/7.29.0",
            },
            "requestId": "XyGnwhe0oAMEJJw=",
            "routeKey": "POST /v2",
            "stage": "$default",
            "time": "01/Sep/2022:13:46:51 +0000",
            "timeEpoch": 1662040011065,
        },
        "body": "LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJMb25lIg0KDQpvbmUNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00MTkwNzMwMDkzMTcyNDkzMTAxNzU5MTUNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0ibXVsdGkiDQoNCm9uZSxzdGlsbG9uZQ0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTQxOTA3MzAwOTMxNzI0OTMxMDE3NTkxNQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJtdWx0aSINCg0KdHdvDQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tNDE5MDczMDA5MzE3MjQ5MzEwMTc1OTE1LS0NCg==",
        "isBase64Encoded": True,
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.apigateway"
    assert lambda_tags.event_type == "aws.apigatewayv2.http.v2"

    assert lambda_tags.api_gateway.account_id == "205994128558"
    assert lambda_tags.api_gateway.api_id == "xxx"
    assert lambda_tags.api_gateway.api_stage == "$default"

    assert lambda_tags.api_gateway.request.id == "XyGnwhe0oAMEJJw="
    assert lambda_tags.api_gateway.request.time_epoch == 1662040011065
    assert lambda_tags.http.protocol == "HTTP/1.1"
    assert lambda_tags.http.host == "xxx.execute-api.us-east-1.amazonaws.com"
    assert lambda_tags.http.request_header_names == [
        "content-length",
        "content-type",
        "multi",
    ]

    assert lambda_tags.http.method == "POST"
    assert lambda_tags.http.path == "/v2"
    assert lambda_tags.http.query_parameter_names == ["lone", "multi"]

    assert lambda_tags.http.status_code == 200

    assert lambda_tags.http_router.path == "/v2"


def test_handle_function_url_payload_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.api_endpoint import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": "/function-url-test",
        "rawQueryString": "lone=value&multi=one,stillone&multi=two",
        "headers": {
            "accept-encoding": "gzip, deflate, br",
            "sec-fetch-dest": "document",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:105.0) Gecko/20100101 Firefox/105.0",
        },
        "queryStringParameters": {"lone": "value", "multi": "one,stillone,two"},
        "requestContext": {
            "accountId": "anonymous",
            "apiId": "xxx",
            "domainName": "xxx.lambda-url.us-east-1.on.aws",
            "domainPrefix": "xxx",
            "http": {
                "method": "GET",
                "path": "/function-url-test",
                "protocol": "HTTP/1.1",
                "sourceIp": "80.55.87.22",
                "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:105.0) Gecko/20100101 Firefox/105.0",
            },
            "requestId": "71ab96bc-8418-4429-863d-2ad7fcbb70d0",
            "routeKey": "$default",
            "stage": "$default",
            "time": "28/Sep/2022:16:10:24 +0000",
            "timeEpoch": 1664381424747,
        },
        "isBase64Encoded": False,
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.lambda"
    assert lambda_tags.event_type == "aws.lambda.url"
    assert lambda_tags.http.protocol == "HTTP/1.1"
    assert lambda_tags.http.host == "xxx.lambda-url.us-east-1.on.aws"
    assert lambda_tags.http.request_header_names == [
        "accept-encoding",
        "sec-fetch-dest",
        "user-agent",
    ]

    assert lambda_tags.http.method == "GET"
    assert lambda_tags.http.path == "/function-url-test"
    assert lambda_tags.http.query_parameter_names == ["lone", "multi"]

    assert lambda_tags.http.status_code == 200


def test_handle_sqs_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "Records": [
            {
                "messageId": "6f606577-4d1f-455c-b504-807abed7ca02",
                "receiptHandle": "AQEB/LOFwavQVbGysR5jhfP3AdX4MVURjti2FpQtoXmpHVtqu+/bYooyXNCiw1isU7Aa+LyAhjX1FiG7EP94Zy+oZOgVYAoBb3yCPRH5IUcRVxlK820ZOBSScsS2/7pgzaC3lZehaQ+haN3w8RZwozPp7CtUEEpNgdWbLsEE/UNI0Yr4iUf7wOXN3UFOu/A5HFgmF3LutB6bHTy7pd0ijycSkRTWGb/WvPMRZk6R496oHVg5cmp0F0OIVBbMdPyCicZcS+k+e8UzwCo+I9V0AKucXQ==",
                "body": '{"foo":"bar2"}',
                "attributes": {
                    "ApproximateReceiveCount": "1",
                    "SentTimestamp": "1662124100657",
                    "SequenceNumber": "18872247843477743616",
                    "MessageGroupId": "1662124100026",
                    "SenderId": "AIDAJJ4KIO2BX5KCDWJDM",
                    "MessageDeduplicationId": "1662124100026",
                    "ApproximateFirstReceiveTimestamp": "1662124100657",
                },
                "messageAttributes": {},
                "md5OfBody": "1ccead62a3eb3d76d0e305271a7aa0b1",
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-east-1:992311060759:test.fifo",
                "awsRegion": "us-east-1",
            },
            {
                "messageId": "6f606577-4d1f-455c-0000-807abed7ca02",
                "receiptHandle": "AQEB/LOFwavQVbGysR5jhfP3AdX4MVURjti2FpQtoXmpHVtqu+/bYooyXNCiw1isU7Aa+LyAhjX1FiG7EP94Zy+oZOgVYAoBb3yCPRH5IUcRVxlK820ZOBSScsS2/7pgzaC3lZehaQ+haN3w8RZwozPp7CtUEEpNgdWbLsEE/UNI0Yr4iUf7wOXN3UFOu/A5HFgmF3LutB6bHTy7pd0ijycSkRTWGb/WvPMRZk6R496oHVg5cmp0F0OIVBbMdPyCicZcS+k+e8UzwCo+I9V0AKucXQ==",
                "body": '{"foo":"bar2"}',
                "attributes": {
                    "ApproximateReceiveCount": "1",
                    "SentTimestamp": "1662124100657",
                    "SequenceNumber": "18872247843477743616",
                    "MessageGroupId": "1662124100026",
                    "SenderId": "AIDAJJ4KIO2BX5KCDWJDM",
                    "MessageDeduplicationId": "1662124100026",
                    "ApproximateFirstReceiveTimestamp": "1662124100657",
                },
                "messageAttributes": {},
                "md5OfBody": "1ccead62a3eb3d76d0e305271a7aa0b1",
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-east-1:992311060759:test.fifo",
                "awsRegion": "us-east-1",
            },
        ]
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.sqs"
    assert lambda_tags.event_type == "aws.sqs"
    assert lambda_tags.sqs.queue_name == "test.fifo"
    assert lambda_tags.sqs.message_ids == [
        "6f606577-4d1f-455c-b504-807abed7ca02",
        "6f606577-4d1f-455c-0000-807abed7ca02",
    ]


def test_handle_sns_event(instrumenter, mocked_print):
    # given
    from ..fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(lambda: handler)

    event = {
        "Records": [
            {
                "EventSource": "aws:sns",
                "EventVersion": "1.0",
                "EventSubscriptionArn": "arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d",
                "Sns": {
                    "Type": "Notification",
                    "MessageId": "135f0427-2c82-5850-930b-5fb608141554",
                    "TopicArn": "arn:aws:sns:us-east-1:xxx:test",
                    "Subject": None,
                    "Message": "test-messsage3",
                    "Timestamp": "2022-09-06T10:35:02.094Z",
                    "SignatureVersion": "1",
                    "Signature": "u2Jbh9dqzF44urgO0/L+Rzo4xQ0i7v5LKzAGHYwBIkBc3JYohiVTDEHru25ygtTP6djC3FSNn54+w2FlyMemli0DlV09BInUkCwt7T2+4B2KPE8iqWMH2byXTYgOhWLoQILKr1VHv44YQA9XyjmW2aUSzitO4I8Fauld5w2kY1NsLO1UX3f/1b6UiS7+N1TiDlHYy/W2fBpcZsLUn/RxmyDTNX0mlS5Ib3fVLPsYVZQpVgHPOrchRK8PvT+UijD0utU1jt3GzURTmGxW2Ys0ICBmb4OzQhUxxHLncXbbJ2HFyVsBGElDE2w6q2kxVf7lWpE6M9F99eoU9DaY0Nhv4w==",
                    "SigningCertUrl": "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-56e67fcb41f6fec09b0196692625d385.pem",
                    "UnsubscribeUrl": "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d",
                    "MessageAttributes": {},
                },
            },
            {
                "EventSource": "aws:sns",
                "EventVersion": "1.0",
                "EventSubscriptionArn": "arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d",
                "Sns": {
                    "Type": "Notification",
                    "MessageId": "135f0427-2c82-5850-0000-5fb608141554",
                    "TopicArn": "arn:aws:sns:us-east-1:xxx:test",
                    "Subject": None,
                    "Message": "test-messsage3",
                    "Timestamp": "2022-09-06T10:35:02.094Z",
                    "SignatureVersion": "1",
                    "Signature": "u2Jbh9dqzF44urgO0/L+Rzo4xQ0i7v5LKzAGHYwBIkBc3JYohiVTDEHru25ygtTP6djC3FSNn54+w2FlyMemli0DlV09BInUkCwt7T2+4B2KPE8iqWMH2byXTYgOhWLoQILKr1VHv44YQA9XyjmW2aUSzitO4I8Fauld5w2kY1NsLO1UX3f/1b6UiS7+N1TiDlHYy/W2fBpcZsLUn/RxmyDTNX0mlS5Ib3fVLPsYVZQpVgHPOrchRK8PvT+UijD0utU1jt3GzURTmGxW2Ys0ICBmb4OzQhUxxHLncXbbJ2HFyVsBGElDE2w6q2kxVf7lWpE6M9F99eoU9DaY0Nhv4w==",
                    "SigningCertUrl": "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-56e67fcb41f6fec09b0196692625d385.pem",
                    "UnsubscribeUrl": "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:xxx:test:89e233cc-10e5-4116-8055-00980269e02d",
                    "MessageAttributes": {},
                },
            },
        ]
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(TARGET_LOG_PREFIX)
    ][0].replace(TARGET_LOG_PREFIX, "")

    # then
    trace_payload = deserialize_trace(serialized)
    lambda_tags = trace_payload.spans[0].tags.aws.__getattribute__("lambda")
    assert lambda_tags.event_source == "aws.sns"
    assert lambda_tags.event_type == "aws.sns"
    assert lambda_tags.sns.topic_name == "test"
    assert lambda_tags.sns.message_ids == [
        "135f0427-2c82-5850-930b-5fb608141554",
        "135f0427-2c82-5850-0000-5fb608141554",
    ]
