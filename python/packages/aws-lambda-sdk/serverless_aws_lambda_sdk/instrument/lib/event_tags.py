from .sdk import serverlessSdk

aws_lambda_span = serverlessSdk.trace_spans.aws_lambda

_API_GATEWAY_EVENT_MAP = [
    "resource",
    "path",
    "httpMethod",
    "headers",
    "multiValueHeaders",
    "queryStringParameters",
    "multiValueQueryStringParameters",
    [
        "requestContext",
        [
            "accountId",
            "apiId",
            "domainName",
            "domainPrefix",
            "extendedRequestId",
            "httpMethod",
            [
                "identity",
                [
                    "cognitoIdentityPoolId",
                    "cognitoIdentityId",
                    "principalOrgId",
                    "cognitoAuthenticationType",
                    "userArn",
                    "userAgent",
                    "accountId",
                    "caller",
                    "sourceIp",
                    "accessKey",
                    "cognitoAuthenticationProvider",
                    "user",
                ],
            ],
            "path",
            "protocol",
            "requestId",
            "requestTime",
            "requestTimeEpoch",
            "resourceId",
            "resourcePath",
            "stage",
        ],
    ],
    "pathParameters",
    "stageVariables",
    "body",
    "isBase64Encoded",
]

_HTTP_API_V2_EVENT_MAP = [
    "version",
    "routeKey",
    "rawPath",
    "rawQueryString",
    "headers",
    [
        "requestContext",
        [
            "accountId",
            "apiId",
            "domainName",
            "domainPrefix",
            ["http", ["method", "path", "protocol", "sourceIp", "userAgent"]],
            "requestId",
            "routeKey",
            "stage",
            "time",
            "timeEpoch",
        ],
    ],
    "isBase64Encoded",
]

_ALB_EVENT_MAP = [
    "path",
    "httpMethod",
    "headers",
    "queryStringParameters",
    ["requestContext", ["elb"]],
    "body",
    "isBase64Encoded",
]

_SQS_EVENT_MAP = [
    [
        "Records",
        [
            [
                0,
                [
                    "messageId",
                    "receiptHandle",
                    "body",
                    [
                        "attributes",
                        [
                            "ApproximateReceiveCount",
                            "SentTimestamp",
                            "SenderId",
                            "ApproximateFirstReceiveTimestamp",
                        ],
                    ],
                    "messageAttributes",
                    "md5OfBody",
                    "eventSource",
                    "eventSourceARN",
                    "awsRegion",
                ],
            ],
        ],
    ],
]

_SNS_EVENT_MAP = [
    [
        "Records",
        [
            [
                0,
                [
                    "EventVersion",
                    "EventSubscriptionArn",
                    "EventSource",
                    [
                        "Sns",
                        [
                            "SignatureVersion",
                            "Timestamp",
                            "Signature",
                            "SigningCertUrl",
                            "MessageId",
                            "Message",
                            "MessageAttributes",
                            "Type",
                            "UnsubscribeUrl",
                            "TopicArn",
                            "Subject",
                        ],
                    ],
                ],
            ],
        ],
    ],
]


def _does_key_match(event, key):
    if isinstance(key, list):
        if key[0] == 0:
            if not isinstance(event, list):
                return False
        elif key[0] not in event:
            return False
        return _does_event_match_map(event[key[0]], key[1])
    return key in event


def _does_event_match_map(event, map):
    if not isinstance(event, list) and not isinstance(event, dict):
        return False
    return all([_does_key_match(event, key) for key in map])


def _resolve_api_gateway_event(event):
    request_context = event.get("requestContext", {})
    aws_lambda_span.tags.update(
        {
            "event_source": "aws.apigateway",
            "event_type": "aws.apigatewayv2.http.v1"
            if event.get("version")
            else "aws.apigateway.rest",
        },
        "aws.lambda",
    )
    aws_lambda_span.tags.update(
        {
            "account_id": request_context.get("accountId"),
            "api_id": request_context.get("apiId"),
            "api_stage": request_context.get("stage"),
        },
        "aws.lambda.api_gateway",
    )
    aws_lambda_span.tags.update(
        {
            "id": request_context.get("requestId"),
            "time_epoch": request_context.get("requestTimeEpoch"),
            "path_parameter_names": list((event.get("pathParameters") or {}).keys()),
        },
        "aws.lambda.api_gateway.request",
    )
    aws_lambda_span.tags.update(
        {
            "method": request_context.get("httpMethod"),
            "protocol": request_context.get("protocol"),
            "host": request_context.get("domainName"),
            "path": request_context.get("path"),
            "query_parameter_names": list(
                (event.get("queryStringParameters") or {}).keys()
            ),
            "request_header_names": list((event.get("headers") or {}).keys()),
        },
        "aws.lambda.http",
    )
    aws_lambda_span.tags.set(
        "aws.lambda.http_router.path", request_context.get("resourcePath")
    )


def _resolve_http_api_v2_event(event):
    request_context = event.get("requestContext", {})
    event_source = (
        "lambdaUrl"
        if ".lambda-url." in request_context.get("domainName")
        else "httpApi"
    )
    if event_source == "lambdaUrl":
        aws_lambda_span.tags.update(
            {"event_source": "aws.lambda", "event_type": "aws.lambda.url"}, "aws.lambda"
        )
    else:
        aws_lambda_span.tags.update(
            {
                "event_source": "aws.apigateway",
                "event_type": "aws.apigatewayv2.http.v2",
            },
            "aws.lambda",
        )
        aws_lambda_span.tags.update(
            {
                "account_id": request_context.get("accountId"),
                "api_id": request_context.get("apiId"),
                "api_stage": request_context.get("stage"),
            },
            "aws.lambda.api_gateway",
        )
        aws_lambda_span.tags.update(
            {
                "id": request_context.get("requestId"),
                "time_epoch": request_context.get("timeEpoch"),
                "path_parameter_names": list(
                    (event.get("pathParameters") or {}).keys()
                ),
            },
            "aws.lambda.api_gateway.request",
        )
        aws_lambda_span.tags.set(
            "aws.lambda.http_router.path",
            "$default"
            if event.get("routeKey") == "$default"
            else event.get("routeKey").split(" ")[-1],
        )

    aws_lambda_span.tags.update(
        {
            "method": request_context.get("http", {}).get("method"),
            "protocol": request_context.get("http", {}).get("protocol"),
            "host": request_context.get("domainName"),
            "path": request_context.get("http", {}).get("path"),
            "query_parameter_names": list(
                (event.get("queryStringParameters") or {}).keys()
            ),
            "request_header_names": list((event.get("headers") or {}).keys()),
        },
        "aws.lambda.http",
    )


def _resolve_alb_event(event):
    aws_lambda_span.tags.update(
        {
            "event_source": "aws.elasticloadbalancing",
            "event_type": "aws.elasticloadbalancing.http",
        },
        "aws.lambda",
    )
    aws_lambda_span.tags.update(
        {
            "method": event.get("httpMethod"),
            "protocol": "http",
            "host": "unknown",
            "path": event.get("path"),
            "query_parameter_names": list(
                (event.get("queryStringParameters") or {}).keys()
            ),
            "request_header_names": list((event.get("headers") or {}).keys()),
        },
        "aws.lambda.http",
    )
    aws_lambda_span.tags.set("aws.lambda.http_router.path", event.get("path"))


def _resolve_sqs_event(event):
    queue_arn = event.get("Records", [{}])[0].get("eventSourceARN")
    aws_lambda_span.tags.update(
        {
            "event_source": "aws.sqs",
            "event_type": "aws.sqs",
        },
        "aws.lambda",
    )
    aws_lambda_span.tags.update(
        {
            "queue_name": queue_arn.split(":")[-1],
            "message_ids": [record.get("messageId") for record in event.get("Records")],
        },
        "aws.lambda.sqs",
    )


def _resolve_sns_event(event):
    topic_arn = event.get("Records", [{}])[0].get("Sns", {}).get("TopicArn")
    aws_lambda_span.tags.update(
        {
            "event_source": "aws.sns",
            "event_type": "aws.sns",
        },
        "aws.lambda",
    )
    aws_lambda_span.tags.update(
        {
            "topic_name": topic_arn.split(":")[-1],
            "message_ids": [
                record.get("Sns", {}).get("MessageId")
                for record in event.get("Records")
            ],
        },
        "aws.lambda.sns",
    )


def resolve(event):
    if not isinstance(event, dict):
        return
    if _does_event_match_map(event, _API_GATEWAY_EVENT_MAP):
        _resolve_api_gateway_event(event)
    elif _does_event_match_map(event, _HTTP_API_V2_EVENT_MAP):
        _resolve_http_api_v2_event(event)
    elif _does_event_match_map(event, _ALB_EVENT_MAP):
        _resolve_alb_event(event)
    elif _does_event_match_map(event, _SQS_EVENT_MAP):
        _resolve_sqs_event(event)
    elif _does_event_match_map(event, _SNS_EVENT_MAP):
        _resolve_sns_event(event)
