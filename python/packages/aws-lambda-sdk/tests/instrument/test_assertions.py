from typing import List
from serverless_sdk_schema import TracePayload
from serverless_sdk_schema.schema.serverless.instrumentation.v1.trace_pb2 import Span
from ..conftest import TEST_FUNCTION, TEST_ORG
from .. import context


def assert_error_event(
    trace_payload: TracePayload, aws_lambda_invocation: Span, outcome
):
    event = trace_payload.events[0]
    assert event.timestamp_unix_nano == aws_lambda_invocation.end_time_unix_nano
    assert event.event_name == "telemetry.error.generated.v1"
    assert event.tags.error.type == 1
    assert event.tags.error.name == "Exception" if outcome == 5 else "SystemExit"


def assert_trace_payload(trace_payload: TracePayload, spans: List[str], outcome: int):
    assert [s.name for s in trace_payload.spans] == spans
    assert trace_payload.sls_tags.org_id == TEST_ORG
    assert trace_payload.sls_tags.service == TEST_FUNCTION
    aws_lambda = [x for x in trace_payload.spans if x.name == "aws.lambda"][0]
    lambda_tag = [
        val for x, val in aws_lambda.tags.aws.ListFields() if x.name == "lambda"
    ][0]
    assert lambda_tag.outcome == outcome
    assert lambda_tag.request_id == context.aws_request_id

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

    if outcome != 1:
        assert_error_event(trace_payload, aws_lambda_invocation, outcome)

    [assert_hexadecimal(s.id) for s in trace_payload.spans]
    [assert_hexadecimal(s.trace_id) for s in trace_payload.spans]
    [
        assert_hexadecimal(s.parent_span_id)
        for s in trace_payload.spans
        if s.parent_span_id
    ]
    [assert_hexadecimal(e.id) for e in trace_payload.events]
    [assert_hexadecimal(e.trace_id) for e in trace_payload.events]
    [assert_hexadecimal(e.span_id) for e in trace_payload.events]


def assert_hexadecimal(id):
    assert isinstance(id, bytes)
    try:
        assert int(id, 16)
    except ValueError:
        assert False
    assert len(id) == 32
