from sls_sdk.lib.imports import internally_imported

with internally_imported():
    import json
    from threading import Thread, Event, Lock
    import os
    import builtins
    import logging

from .telemetry import send, close_connection
from .sdk import serverlessSdk
from .invocation_context import get as get_invocation_context
from .payload_conversion import to_trace_payload, serialize_to_string
from .captured_event import should_include as should_include_event_captured_event

_original_print = builtins.print


def _print(self, *args, **kwargs):
    # to make sure print & logging calls from multiple threads are serialized properly
    with logging._lock:
        _original_print(self, *args, **kwargs)


builtins.print = _print


class ThreadSafeBuffer:
    def __init__(self):
        self._pending_spans = []
        self._pending_captured_events = []
        self._pending_request_response_payloads = []
        self._lock = Lock()

    def get_all(self):
        with self._lock:
            spans, captured_events, request_response_payloads = (
                self._pending_spans.copy(),
                self._pending_captured_events.copy(),
                self._pending_request_response_payloads.copy(),
            )

            self._pending_spans.clear()
            self._pending_captured_events.clear()
            self._pending_request_response_payloads.clear()
            return (spans, captured_events, request_response_payloads)

    def add_span(self, span):
        with self._lock:
            self._pending_spans.append(span)

    def add_captured_event(self, captured_event):
        with self._lock:
            self._pending_captured_events.append(captured_event)

    def add_request_response_payload(self, request_response_payload):
        with self._lock:
            self._pending_request_response_payloads.append(request_response_payload)

    def __len__(self):
        with self._lock:
            return (
                len(self._pending_captured_events)
                + len(self._pending_spans)
                + len(self._pending_request_response_payloads)
            )


class DevModeThread(Thread):
    """
    Used to send telemetry data to dev-mode extension, in a separate thread.
    The thread executes a while loop until terminated from upstream.
    Communication between the main thread and the dev mode thread:
    Main thread can:
    1. add spans and captured events to the buffer.
    2. add a request/response type payload to be sent in the dev mode thread loop.
    3. flush the buffer and stop the dev mode thread.
    """

    def __init__(self, start_event: Event):
        super().__init__()

        self._loop = None
        self._has_started = (
            start_event  # when the thread starts, the event will be signalled
        )
        self._buffered_data = (
            ThreadSafeBuffer()
        )  # used to buffer spans and captured events
        self._is_stopped_event = Event()  # used to stop the thread

    def _send_all(self):
        (
            spans,
            captured_events,
            request_response_payload,
        ) = self._buffered_data.get_all()

        for payload in request_response_payload:
            send("request-response", payload)

        if not spans and not captured_events:
            return

        def _convert_span(span):
            span_payload = span.to_protobuf_dict()
            del span_payload["input"]
            del span_payload["output"]
            return span_payload

        payload = {
            "slsTags": {
                "orgId": serverlessSdk.org_id,
                "service": os.environ.get("AWS_LAMBDA_FUNCTION_NAME", None),
                "sdk": {
                    "name": serverlessSdk.name,
                    "version": serverlessSdk.version,
                    "runtime": "python",
                },
            },
            "spans": [_convert_span(s) for s in spans],
            "events": [
                e.to_protobuf_dict()
                for e in filter(should_include_event_captured_event, captured_events)
            ],
            "customTags": json.dumps(serverlessSdk._custom_tags),
        }
        if not get_invocation_context():
            payload["spans"] = [
                s for s in payload["spans"] if s["name"] != "aws.lambda"
            ]

        send("trace", serialize_to_string(to_trace_payload(payload)))

    def add_span(self, span):
        """Executes in the context of the main thread."""
        self._buffered_data.add_span(span)

    def add_captured_event(self, captured_event):
        """Executes in the context of the main thread."""
        self._buffered_data.add_captured_event(captured_event)

    def add_request_response_payload(self, request_response_payload):
        """Executes in the context of the main thread."""
        self._buffered_data.add_request_response_payload(request_response_payload)

    def run(self):
        """Executes in the context of the dev-mode thread."""

        # signal that the thread is running
        self._has_started.set()

        while True:
            is_stopped = self._is_stopped_event.wait(0.05)
            if is_stopped:
                break

            self._send_all()

        self._send_all()
        close_connection()

    def terminate(self):
        """
        Signal the thread to stop, any remaining data will be flushed.
        """
        self._is_stopped_event.set()
        self.join()


def get_dev_mode_thread() -> DevModeThread:
    event = Event()
    thread = DevModeThread(event)
    thread.start()
    event.wait()
    return thread
