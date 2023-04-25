from __future__ import annotations
import time
import json
import pytest
from unittest.mock import MagicMock
from sls_sdk.lib.captured_event import CapturedEvent
from sls_sdk.lib.tags import Tags, convert_tags_to_protobuf
from sls_sdk.lib.timing import to_protobuf_epoch_timestamp
import sls_sdk.lib.captured_event


@pytest.fixture(autouse=True)
def _reset_sdk(reset_sdk):
    pass


def test_captured_event():
    # given
    timestamp = time.perf_counter_ns()
    tags = Tags()
    tags.update({"foo.bar": "baz"})
    event_name = "foo.bar.event"
    fingerprint = "foo_bar"
    origin = "python-test"
    captured_event = CapturedEvent(
        event_name,
        timestamp=timestamp,
        custom_tags=tags,
        custom_fingerprint=fingerprint,
        origin=origin,
    )

    # when
    protobuf_dict = captured_event.to_protobuf_dict()

    # then
    assert protobuf_dict == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id
        if captured_event.trace_span
        else None,
        "spanId": captured_event.trace_span.id if captured_event.trace_span else None,
        "timestampUnixNano": to_protobuf_epoch_timestamp(timestamp),
        "eventName": event_name,
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps(tags),
        "customFingerprint": fingerprint,
    }
    assert captured_event.origin == origin


def test_captured_event_invalid_custom_tags(monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.captured_event, "report_error", mock)
    timestamp = time.perf_counter_ns()
    tags = {"foo- !": "bar"}
    event_name = "foo.bar.event"
    fingerprint = "foo_bar"
    origin = "python-test"
    captured_event = CapturedEvent(
        event_name,
        timestamp=timestamp,
        custom_tags=tags,
        custom_fingerprint=fingerprint,
        origin=origin,
    )

    # when
    protobuf_dict = captured_event.to_protobuf_dict()

    # then
    assert protobuf_dict == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id
        if captured_event.trace_span
        else None,
        "spanId": captured_event.trace_span.id if captured_event.trace_span else None,
        "timestampUnixNano": to_protobuf_epoch_timestamp(timestamp),
        "eventName": event_name,
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps({}),
        "customFingerprint": fingerprint,
    }
    assert captured_event.origin == origin
    mock.assert_called_once()
