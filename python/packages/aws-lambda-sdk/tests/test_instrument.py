from __future__ import annotations
from importlib import reload
import pytest
from unittest.mock import patch
from . import assert_trace_payload, compare_handlers, context
from serverless_sdk_schema import TracePayload
import base64


@pytest.fixture()
def instrumenter(reset_sdk):
    from serverless_aws_lambda_sdk.instrument import Instrumenter

    return Instrumenter()


def test_instrument_is_callable(instrumenter):
    assert callable(instrumenter.instrument)


def test_instrument_wraps_callable(instrumenter, reset_sdk):
    def example(event, context):
        pass

    result = instrumenter.instrument(example)
    assert callable(result)
    result({}, context)


def test_instrumented_callable_behaves_like_original(instrumenter, reset_sdk):
    def example(event, context) -> str:
        return context.aws_request_id

    instrumented = instrumenter.instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables(instrumenter, reset_sdk):
    class Example:
        def __call__(self, event, context) -> str:
            return context.aws_request_id

    example = Example()
    instrumented = instrumenter.instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_lambda_success(instrumenter, reset_sdk):
    # given
    from .fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with patch("builtins.print") as mocked_print:
        instrumented({}, context)
        serialized = mocked_print.call_args_list[0][0][0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(trace_payload, 1)


def test_instrument_subsequent_calls(instrumenter):
    # given
    from .fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with patch("builtins.print") as mocked_print:
        instrumented({}, context)
        instrumented({}, context)
        first = mocked_print.call_args_list[0][0][0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )
        second = mocked_print.call_args_list[1][0][0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )

    # then
    first_trace_payload = TracePayload.FromString(base64.b64decode(first))
    assert_trace_payload(first_trace_payload, 1)

    second_trace_payload = TracePayload.FromString(base64.b64decode(second))

    assert [s.name for s in first_trace_payload.spans] == [
        "aws.lambda",
        "aws.lambda.initialization",
        "aws.lambda.invocation",
    ]
    assert [s.name for s in second_trace_payload.spans] == [
        "aws.lambda",
        "aws.lambda.invocation",
    ]

    aws_lambda, aws_lambda_invocation = (
        second_trace_payload.spans[0],
        second_trace_payload.spans[-1],
    )
    assert aws_lambda.start_time_unix_nano == aws_lambda_invocation.start_time_unix_nano


def test_instrument_lambda_handled_error(instrumenter, reset_sdk):
    # given
    from .fixtures.lambdas.error_unhandled import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with patch("builtins.print") as mocked_print:
        with pytest.raises(SystemExit):
            instrumented({}, context)
        serialized = mocked_print.call_args_list[0][0][0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(trace_payload, 3)


def test_instrument_lambda_unhandled_error(instrumenter, reset_sdk):
    # given
    from .fixtures.lambdas.error import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with patch("builtins.print") as mocked_print:
        with pytest.raises(Exception):
            instrumented({}, context)
        serialized = mocked_print.call_args_list[0][0][0].replace(
            "SERVERLESS_TELEMETRY.T.", ""
        )

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(trace_payload, 5)
