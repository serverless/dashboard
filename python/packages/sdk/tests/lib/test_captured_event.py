from __future__ import annotations
import time
import json
from serverless_sdk.lib.captured_event import CapturedEvent
from serverless_sdk.lib.tags import Tags, convert_tags_to_protobuf
from serverless_sdk.lib.timing import to_protobuf_epoch_timestamp


def test_captured_event():
    # given
    timestamp = time.perf_counter_ns()
    tags = Tags()
    tags.update({"foo": "bar"})
    event_name = "foo.bar.event"
    captured_event = CapturedEvent(event_name, timestamp=timestamp, custom_tags=tags)

    # when
    protobuf_dict = captured_event.to_protobuf_dict()

    # then
    assert protobuf_dict == {
        "id": captured_event.id,
        "traceId": captured_event.trace_span.trace_id,
        "spanId": captured_event.trace_span.id,
        "timestampUnixNano": to_protobuf_epoch_timestamp(timestamp),
        "eventName": event_name,
        "tags": convert_tags_to_protobuf(captured_event.tags),
        "customTags": json.dumps(convert_tags_to_protobuf(tags)),
    }