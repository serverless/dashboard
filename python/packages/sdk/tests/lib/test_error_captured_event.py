from __future__ import annotations
from unittest import mock
from unittest.mock import MagicMock
import pytest
import json


@pytest.fixture(autouse=True)
def _instrumented_sdk(instrumented_sdk):
    return instrumented_sdk


def assert_protobuf_dict(captured_event, tags, fingerprint=None):
    from sls_sdk.lib.tags import convert_tags_to_protobuf
    from sls_sdk.lib.timing import to_protobuf_epoch_timestamp

    assert captured_event.to_protobuf_dict() == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id
        if captured_event.trace_span
        else None,
        "spanId": captured_event.trace_span.id if captured_event.trace_span else None,
        "eventName": "telemetry.error.generated.v1",
        "timestampUnixNano": to_protobuf_epoch_timestamp(captured_event.timestamp),
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps(tags),
        "customFingerprint": fingerprint,
    }


def test_create_error_captured_event():
    # given
    from sls_sdk.lib.error_captured_event import (
        create as create_error_captured_event,
        logger,
    )

    error = Exception("Captured error")
    tags = {"user.tag": "example"}
    origin = "python-test"
    fingerprint = "foo"

    # when
    with mock.patch.object(logger, "error") as mock_logger:
        captured_event = create_error_captured_event(
            error,
            tags=tags,
            fingerprint=fingerprint,
            origin=origin,
        )
        mock_logger.assert_called_once_with(
            {
                "source": "serverlessSdk",
                "type": "ERROR_TYPE_CAUGHT_USER",
                "name": "Exception",
                "message": "Captured error",
                "stack": "Exception: Captured error\n",
                "fingerprint": fingerprint,
            }
        )

    # then
    assert_protobuf_dict(captured_event, tags, fingerprint=fingerprint)


def test_create_error_captured_event_disabled(_instrumented_sdk, monkeypatch):
    # given
    from sls_sdk.lib.error_captured_event import (
        create as create_error_captured_event,
        logger,
    )

    error = Exception("Captured error")
    tags = {"user.tag": "example"}
    settings = MagicMock()
    settings.disable_captured_events_stdout = "1"
    monkeypatch.setattr(_instrumented_sdk, "_settings", settings)

    # when
    with mock.patch.object(logger, "error") as mock_logger:
        captured_event = create_error_captured_event(
            error,
            tags=tags,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)


def test_create_error_captured_event_from_python_console():
    # given
    from sls_sdk.lib.error_captured_event import (
        create as create_error_captured_event,
        logger,
    )

    error = Exception("Captured error")
    tags = {"user.tag": "example"}
    origin = "pythonLogging"

    # when
    with mock.patch.object(logger, "error") as mock_logger:
        captured_event = create_error_captured_event(
            error,
            tags=tags,
            origin=origin,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)


def test_create_error_captured_event_unhandled():
    # given
    from sls_sdk.lib.error_captured_event import (
        create as create_error_captured_event,
        logger,
    )

    error = Exception("Captured error")
    tags = {"user.tag": "example"}
    type = "unhandled"

    # when
    with mock.patch.object(logger, "error") as mock_logger:
        captured_event = create_error_captured_event(
            error,
            tags=tags,
            type=type,
        )
        mock_logger.assert_not_called()

    # then
    assert_protobuf_dict(captured_event, tags)
