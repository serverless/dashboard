from __future__ import annotations
from unittest import mock
import json
from serverless_sdk.lib.error_captured_event import (
    create as create_error_captured_event,
    logger,
)
from serverless_sdk.lib.tags import Tags, convert_tags_to_protobuf
from serverless_sdk.lib.timing import to_protobuf_epoch_timestamp


def test_create_error_captured_event():
    # given
    error = Exception("Captured error")
    tags = {"user.tag": "example"}

    # when
    with mock.patch.object(logger, "error") as mock_logger:
        captured_event = create_error_captured_event(
            error,
            tags=tags,
        )
        mock_logger.assert_called_once_with(
            {
                "source": "serverlessSdk",
                "type": "ERROR_TYPE_CAUGHT_USER",
                "name": "Exception",
                "message": "Captured error",
                "stack": "Exception: Captured error\n",
            }
        )

    # then
    assert captured_event.to_protobuf_dict() == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id,
        "spanId": captured_event.trace_span.id,
        "eventName": "telemetry.error.generated.v1",
        "timestampUnixNano": to_protobuf_epoch_timestamp(captured_event.timestamp),
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps(convert_tags_to_protobuf(tags)),
    }
