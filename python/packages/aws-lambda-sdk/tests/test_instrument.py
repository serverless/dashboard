from __future__ import annotations

import pytest
from unittest.mock import patch
from . import compare_handlers, context
from serverless_sdk_schema import TracePayload
import base64


TEST_ORG = "test-org"
TEST_FUNCTION = "test-function"


@pytest.fixture
def instrument(monkeypatch):
    monkeypatch.setenv("_SLS_PROCESS_START_TIME", "0")
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", TEST_FUNCTION)
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_VERSION", "1")
    monkeypatch.setenv("SLS_ORG_ID", "test-org")
    from serverless_aws_lambda_sdk.instrument import instrument

    return instrument


def test_instrument_is_callable(instrument):
    assert callable(instrument)


def test_instrument_wraps_callable(instrument):
    def example(event, context):
        pass

    result = instrument(example)
    assert callable(result)
    result({}, context)


def test_instrumented_callable_behaves_like_original(instrument):
    def example(event, context) -> str:
        return context.aws_request_id

    instrumented = instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables(instrument):
    class Example:
        def __call__(self, event, context) -> str:
            return context.aws_request_id

    example = Example()
    instrumented = instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_adds_lambda_trace_spans(instrument):
    with patch("builtins.print") as mocked_print:
        # given
        def handler(event, context):
            return context.aws_request_id

        # when
        instrument(handler)({}, context)
        serialized = mocked_print.call_args.args[0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert set([s.name for s in trace_payload.spans]) == set(
        [
            "aws.lambda.initialization",
            "aws.lambda.invocation",
            "aws.lambda",
        ]
    )
    assert trace_payload.sls_tags.org_id == TEST_ORG
    assert trace_payload.sls_tags.service == TEST_FUNCTION
    aws_lambda = [x for x in trace_payload.spans if x.name == "aws.lambda"][0]
    assert aws_lambda.tags.aws.lambda_.outcome == 1
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
