from __future__ import annotations
from typing_extensions import Final, TypeAlias
from types import MethodType

import pytest

from . import get_params


TEST_NAME: Final[str] = "Test Span"
TEST_INPUT: Final[str] = "Test Input"
TEST_OUTPUT: Final[str] = "Test Output"
TEST_START_TIME: Final[int] = 1_000_000


TraceSpan: TypeAlias = "TraceSpan"


@pytest.fixture
def trace_span() -> TraceSpan:
    from ..trace_span import TraceSpan

    return TraceSpan


@pytest.fixture
def trace_span() -> TraceSpan:
    from ..trace_span import TraceSpan

    return TraceSpan(
        name=TEST_NAME,
        input=TEST_INPUT,
        output=TEST_OUTPUT,
        start_time=TEST_START_TIME,
    )


def test_can_import_trace_span():
    try:
        from ..trace_span import TraceSpan

    except ImportError as e:
        raise AssertionError("Cannot import TraceSpan") from e


def test_has_id(trace_span: TraceSpan):
    assert hasattr(trace_span, "id")


def test_has_trace_id(trace_span: TraceSpan):
    assert hasattr(trace_span, "traceId")


def test_has_name(trace_span: TraceSpan):
    assert hasattr(trace_span, "name")


def test_has_start_time(trace_span: TraceSpan):
    assert hasattr(trace_span, "startTime")


def test_has_input(trace_span: TraceSpan):
    assert hasattr(trace_span, "input")


def test_has_output(trace_span: TraceSpan):
    assert hasattr(trace_span, "output")


def test_has_parent_span(trace_span: TraceSpan):
    assert hasattr(trace_span, "parentSpan")


def test_has_tags(trace_span: TraceSpan):
    assert hasattr(trace_span, "tags")


def test_has_close_method(trace_span: TraceSpan):
    assert hasattr(trace_span, "close")
    assert isinstance(trace_span.close, MethodType)

    params = get_params(trace_span.close)

    assert len(params) >= 1
    assert "close" in params


def test_has_to_protobuf_object_method(trace_span: TraceSpan):
    assert hasattr(trace_span, "toProtobufObject")
    assert isinstance(trace_span.toProtobufObject, MethodType)

    params = get_params(trace_span.toProtobufObject)

    assert len(params) <= 1


def test_can_set_output(trace_span: TraceSpan):
    assert trace_span.output == TEST_OUTPUT

    new_output: str = "New Output"
    trace_span.output = new_output

    assert trace_span.output == new_output
