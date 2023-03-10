from __future__ import annotations

import inspect
import sys
from pathlib import Path
from typing import Callable, Dict
from serverless_sdk_schema import TracePayload


sys.path.append(str(Path(__file__).parent / "fixtures/lambdas"))

Params = Dict[str, inspect.Parameter]


class Context:
    aws_request_id: str


context = Context()
context.aws_request_id = "test-request"

TEST_ORG = "test-org"
TEST_FUNCTION = "test-function"


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters


def compare_handlers(original, instrumented):
    assert callable(original) and callable(instrumented)

    orig_params = get_params(original)
    instrumented_params = get_params(instrumented)
    assert orig_params == instrumented_params

    orig_result = original({}, context)
    instrumented_result = instrumented({}, context)
    assert orig_result == instrumented_result


def assert_trace_payload(trace_payload: TracePayload, outcome: int):
    assert [s.name for s in trace_payload.spans] == [
        "aws.lambda",
        "aws.lambda.initialization",
        "aws.lambda.invocation",
    ]
    assert trace_payload.sls_tags.org_id == TEST_ORG
    assert trace_payload.sls_tags.service == TEST_FUNCTION
    aws_lambda = [x for x in trace_payload.spans if x.name == "aws.lambda"][0]
    assert aws_lambda.tags.aws.lambda_.outcome == outcome
    assert aws_lambda.tags.aws.lambda_.request_id == context.aws_request_id

    aws_lambda_initialization = [
        x for x in trace_payload.spans if x.name == "aws.lambda.initialization"
    ][0]
    aws_lambda_invocation = [
        x for x in trace_payload.spans if x.name == "aws.lambda.invocation"
    ][0]
    assert (
        aws_lambda_initialization.start_time_unix_nano
        == aws_lambda.start_time_unix_nano
    )
    assert (
        aws_lambda_invocation.start_time_unix_nano
        > aws_lambda_initialization.start_time_unix_nano
    )
    for span in trace_payload.spans:
        assert span.start_time_unix_nano < span.end_time_unix_nano
