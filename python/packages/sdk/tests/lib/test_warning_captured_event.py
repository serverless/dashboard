from __future__ import annotations
from unittest import mock
from unittest.mock import MagicMock
import json
from serverless_sdk.lib.warning_captured_event import (
    create as create_warning_captured_event,
    logger,
)
from serverless_sdk import serverlessSdk
from serverless_sdk.lib.tags import Tags, convert_tags_to_protobuf
from serverless_sdk.lib.timing import to_protobuf_epoch_timestamp


def assert_protobuf_dict(captured_event, tags, fingerprint=None):
    assert captured_event.to_protobuf_dict() == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id
        if captured_event.trace_span
        else None,
        "spanId": captured_event.trace_span.id if captured_event.trace_span else None,
        "eventName": "telemetry.warning.generated.v1",
        "timestampUnixNano": to_protobuf_epoch_timestamp(captured_event.timestamp),
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps(tags),
        "customFingerprint": fingerprint,
    }


def test_create_warning_captured_event():
    # given
    message = "Warning message"
    tags = {"user.tag": "example"}
    origin = "python-test"
    fingerprint = "foo"

    # when
    with mock.patch.object(logger, "warning") as mock_logger:
        captured_event = create_warning_captured_event(
            message,
            tags=tags,
            fingerprint=fingerprint,
            origin=origin,
        )
        mock_logger.call_args[0][0].items() <= dict(
            {
                "source": "serverlessSdk",
                "type": 1,
                "message": message,
            }
        ).items()

    # then
    assert_protobuf_dict(captured_event, tags, fingerprint=fingerprint)


def test_create_warning_captured_event_disabled(monkeypatch):
    # given
    message = "Warning message"
    tags = {"user.tag": "example"}
    settings = MagicMock()
    settings.disable_captured_events_stdout = "1"
    monkeypatch.setattr(serverlessSdk, "_settings", settings)

    # when
    with mock.patch.object(logger, "warning") as mock_logger:
        captured_event = create_warning_captured_event(
            message,
            tags=tags,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)


def test_create_warning_captured_event_from_python_console():
    # given
    message = "Warning message"
    tags = {"user.tag": "example"}
    origin = "pythonLogging"

    # when
    with mock.patch.object(logger, "warning") as mock_logger:
        captured_event = create_warning_captured_event(
            message,
            tags=tags,
            origin=origin,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)


def test_create_warning_captured_event_sdk_internal():
    # given
    message = "Warning message"
    tags = {"user.tag": "example"}
    type = "sdkInternal"

    # when
    with mock.patch.object(logger, "warning") as mock_logger:
        captured_event = create_warning_captured_event(
            message,
            tags=tags,
            type=type,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)
