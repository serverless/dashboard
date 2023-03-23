from __future__ import annotations
import pytest
from unittest.mock import patch, MagicMock
import json
from .. import compare_handlers, context
from .test_assertions import assert_trace_payload
from serverless_sdk_schema import TracePayload, RequestResponse
import base64
from werkzeug.wrappers import Request, Response
from pytest_httpserver import HTTPServer

_TARGET_LOG_PREFIX = "SERVERLESS_TELEMETRY.T."


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


def test_instrument_lambda_success(instrumenter, reset_sdk, mocked_print):
    # given
    from ..fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(handler)

    # when
    instrumented({}, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        1,
    )


def test_instrument_subsequent_calls(instrumenter):
    # given
    from ..fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(handler)
    from builtins import print

    # when
    with patch("builtins.print") as mocked_print:
        mocked_print.side_effect = print
        instrumented({}, context)
        first = [
            x[0][0]
            for x in mocked_print.call_args_list
            if x[0][0].startswith(_TARGET_LOG_PREFIX)
        ][0].replace(_TARGET_LOG_PREFIX, "")

    with patch("builtins.print") as mocked_print:
        mocked_print.side_effect = print
        instrumented({}, context)
        second = [
            x[0][0]
            for x in mocked_print.call_args_list
            if x[0][0].startswith(_TARGET_LOG_PREFIX)
        ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    first_trace_payload = TracePayload.FromString(base64.b64decode(first))
    assert_trace_payload(
        first_trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        1,
    )

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


def test_instrument_lambda_unhandled_error(instrumenter, reset_sdk, mocked_print):
    # given
    from ..fixtures.lambdas.error_unhandled import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with pytest.raises(SystemExit):
        instrumented({}, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        3,
    )


def test_instrument_lambda_handled_error(instrumenter, reset_sdk, mocked_print):
    # given
    from ..fixtures.lambdas.error import handler

    instrumented = instrumenter.instrument(handler)

    # when
    with pytest.raises(Exception):
        instrumented({}, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        5,
    )


def _assert_event(
    event,
    timestamp,
    event_name,
    type,
    message,
    custom_tags,
    error_name=None,
):
    assert event.timestamp_unix_nano < timestamp
    assert event.event_name == event_name
    if event.tags.error:
        assert event.tags.error.type == type
        assert event.tags.error.name == error_name
        assert event.tags.error.message == message
    else:
        assert event.tags.warning.type == type
        assert event.tags.warning.message == message
    assert event.custom_tags == json.dumps(custom_tags)


def test_instrument_lambda_sdk(instrumenter, reset_sdk):
    # given
    from ..fixtures.lambdas.sdk import handler

    instrumented = instrumenter.instrument(handler)

    def _test_once(invocation, asserted_spans=[]):
        from logging import Logger

        original_error_logger = Logger.error
        original_warning_logger = Logger.warning

        # when
        with patch("builtins.print") as mocked_print, patch.object(
            Logger, "error", autospec=True
        ) as mock_error_logger, patch.object(
            Logger, "warning", autospec=True
        ) as mock_warning_logger:
            mock_error_logger.side_effect = original_error_logger
            mock_warning_logger.side_effect = original_warning_logger
            instrumented({}, context)

            serialized = [
                x[0][0]
                for x in mocked_print.call_args_list
                if x[0][0].startswith(_TARGET_LOG_PREFIX)
            ][0].replace(_TARGET_LOG_PREFIX, "")

        # then
        trace_payload = TracePayload.FromString(base64.b64decode(serialized))
        if asserted_spans:
            assert_trace_payload(
                trace_payload,
                asserted_spans,
                1,
            )
        aws_lambda_invocation = [
            x for x in trace_payload.spans if x.name == "aws.lambda.invocation"
        ][0]

        _assert_event(
            trace_payload.events[0],
            aws_lambda_invocation.end_time_unix_nano,
            "telemetry.error.generated.v1",
            2,
            "Captured error",
            {"user.tag": "example", "invocationid": invocation},
            "Exception",
        )

        _assert_event(
            trace_payload.events[1],
            aws_lambda_invocation.end_time_unix_nano,
            "telemetry.error.generated.v1",
            2,
            "My error:",
            {},
            "str",
        )

        _assert_event(
            trace_payload.events[2],
            aws_lambda_invocation.end_time_unix_nano,
            "telemetry.warning.generated.v1",
            1,
            "Captured warning",
            {"user.tag": "example", "invocationid": invocation},
        )

        _assert_event(
            trace_payload.events[3],
            aws_lambda_invocation.end_time_unix_nano,
            "telemetry.warning.generated.v1",
            1,
            "Consoled warning 12 True",
            {},
        )

        assert trace_payload.custom_tags == json.dumps(
            {"user.tag": f"example:{invocation}"}
        )

        assert mock_error_logger.call_count == 2
        assert mock_warning_logger.call_count == 2

    _test_once(
        1,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
            "user.span",
        ],
    )
    _test_once(2)


@pytest.mark.parametrize("sampled_out", [True, False])
def test_instrument_sdk_sampled_out(
    monkeypatch, instrumenter, reset_sdk, sampled_out, mocked_print
):
    # given
    monkeypatch.setattr("random.random", lambda: 0.9 if sampled_out else 0.1)
    from ..fixtures.lambdas.sdk_sampled_out import handler

    instrumented = instrumenter.instrument(handler)

    # when
    instrumented({}, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ]
        + (["user.span"] if not sampled_out else []),
        1,
    )
    assert (sampled_out and trace_payload.custom_tags is None) or (
        not sampled_out and trace_payload.custom_tags is not None
    )


def test_instrument_lambda_success_dev_mode_without_server(
    reset_sdk_dev_mode, mocked_print
):
    # given
    from ..fixtures.lambdas.success import handler
    from serverless_aws_lambda_sdk.instrument import Instrumenter

    instrumenter = Instrumenter()
    instrumented = instrumenter.instrument(handler)

    # when
    instrumented({}, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        1,
    )


def test_instrument_lambda_success_dev_mode_with_server(
    reset_sdk_dev_mode, mocked_print, httpserver_listen_address, httpserver: HTTPServer
):
    # given
    request_response_payloads = []
    trace_payloads = []

    def handler(request: Request):
        payload_type = request.url.split("/")[-1]
        if payload_type == "request-response":
            request_response_payloads.append(RequestResponse().parse(request.data))
        elif payload_type == "trace":
            trace_payloads.append(TracePayload().parse(request.data))
        else:
            raise Exception(f"Unexpected payload type: {payload_type}")
        return Response(str("OK"))

    httpserver.expect_request("/request-response").respond_with_handler(handler)
    httpserver.expect_request("/trace").respond_with_handler(handler)

    from ..fixtures.lambdas.success import handler
    from serverless_aws_lambda_sdk.instrument import Instrumenter

    instrumenter = Instrumenter()
    instrumented = instrumenter.instrument(handler)

    event = {
        "foo": "bar",
    }

    # when
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        1,
    )

    assert [(p.origin, json.loads(p.body)) for p in request_response_payloads] == [
        (1, event),
        (2, "ok"),
    ]
    assert [s.name for t in trace_payloads for s in t.spans] == [
        "aws.lambda.initialization",
        "aws.lambda.invocation",
        "aws.lambda",
    ]

    # when
    request_response_payloads = []
    trace_payloads = []
    instrumented(event, context)
    serialized = [
        x[0][0]
        for x in mocked_print.call_args_list
        if x[0][0].startswith(_TARGET_LOG_PREFIX)
    ][0].replace(_TARGET_LOG_PREFIX, "")

    # then
    trace_payload = TracePayload.FromString(base64.b64decode(serialized))
    assert_trace_payload(
        trace_payload,
        [
            "aws.lambda",
            "aws.lambda.initialization",
            "aws.lambda.invocation",
        ],
        1,
    )

    assert [(p.origin, json.loads(p.body)) for p in request_response_payloads] == [
        (1, event),
        (2, "ok"),
    ]
    assert [s.name for t in trace_payloads for s in t.spans] == [
        "aws.lambda.invocation",
        "aws.lambda",
    ]


def test_instrument_lambda_success_close_trace_failure(instrumenter, reset_sdk):
    # given
    from ..fixtures.lambdas.success import handler

    instrumented = instrumenter.instrument(handler)
    _original = instrumenter._close_trace
    instrumenter._close_trace = MagicMock()
    instrumenter._close_trace.side_effect = Exception("_close_trace failed")

    # when
    with pytest.raises(Exception, match="_close_trace failed"):
        instrumented({}, context)

    # then
    instrumenter._close_trace.assert_called_once_with("success", "ok")
    instrumenter._close_trace = _original
