from typing import Any, Dict
from typing_extensions import Final
from google.protobuf import json_format

OUTCOME_SUCCESS: Final[int] = 1

# from https://github.com/serverless/console/blob/main/node/packages/sdk-schema/test/unit/span.test.js#L18
TEST_PAYLOAD: Final[Dict[str, Any]] = {
    "slsTags": {
        "orgId": "abc123",
        "sdk": {"name": "aws-lambda-sdk", "version": "0.0.1"},
        "platform": "lambda",
        "region": "us-east-1",
        "service": "my-test-function",
    },
    "spans": [
        {
            "id": "Y2M4MWUwNjctMWNmYi00ZmYxLWE2OWItMDVhOTQ4NGZmZmFk",
            "traceId": "YTZkZTMxMzgtMmM0ZS00M2QxLTk0YTAtMDVmMjQ0NzJlNjg1",
            "name": "test",
            "startTimeUnixNano": 1,
            "endTimeUnixNano": 1,
            "tags": {
                "aws": {
                    "lambda": {
                        "arch": "arm64",
                        "isColdstart": True,
                        "eventType": "aws.apigatewayv2",
                        "eventSource": "aws.apigatewayv2",
                        "logGroup": "abc12",
                        "logStreamName": "abc123",
                        "maxMemory": 1024,
                        "name": "my-test-function",
                        "requestId": "bdb40738-ff36-48c0-9842-9befd0141cd6",
                        "version": "$LATEST",
                        "outcome": OUTCOME_SUCCESS,
                        "apiGateway": {
                            "accountId": "012345678901",
                            "apiId": "abc123",
                            "apiStage": "dev",
                            "request": {
                                "id": "2e4d98fe-1603-477f-b976-1013e84ea4a6",
                                "timeEpoch": 1,
                                "pathParameterNames": [],
                            },
                        },
                        "http": {
                            "protocol": "HTTP/1.1",
                            "host": "abc.example.com",
                            "method": "GET",
                            "path": "/test",
                            "queryParameterNames": [],
                            "requestHeaderNames": [],
                        },
                    }
                }
            },
        }
    ],
    "events": [],
}


def test_trace_payload_exported():
    try:
        from serverless_sdk_schema import TracePayload

    except ImportError as e:
        raise AssertionError("TracePayload not exported") from e


def test_request_response_exported():
    try:
        from serverless_sdk_schema import RequestResponse

    except ImportError as e:
        raise AssertionError("RequestResponse not exported") from e


def test_trace_payload():
    from serverless_sdk_schema import TracePayload

    payload = json_format.ParseDict(TEST_PAYLOAD, TracePayload())
    assert payload
