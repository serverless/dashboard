import asyncio
import json
from threading import Thread, Event, Lock
import os
from .telemetry import send_async, close_session
from .sdk import serverlessSdk
from .invocation_context import get as get_invocation_context
from .payload_conversion import to_trace_payload


class SynchronizedCounter:
    def __init__(self, value=0):
        self._value = value
        self._lock = Lock()

    def increment(self):
        with self._lock:
            self._value += 1

    def decrement(self):
        with self._lock:
            self._value -= 1

    def value(self):
        with self._lock:
            return self._value


class ThreadSafeBuffer:
    def __init__(self):
        self._pending_spans = []
        self._pending_captured_events = []
        self._lock = Lock()

    def get_all(self):
        with self._lock:
            spans, captured_events = (
                self._pending_spans.copy(),
                self._pending_captured_events.copy(),
            )

            self._pending_spans.clear()
            self._pending_captured_events.clear()
            return (spans, captured_events)

    def add_span(self, span):
        with self._lock:
            self._pending_spans.append(span)

    def add_captured_event(self, captured_event):
        with self._lock:
            self._pending_captured_events.append(captured_event)

    def __len__(self):
        with self._lock:
            return len(self._pending_captured_events) + len(self._pending_spans)


class SynchronizedVariable:
    def __init__(self, value=None):
        self._value = value
        self._lock = Lock()

    def set(self, value):
        with self._lock:
            self._value = value

    def get(self):
        with self._lock:
            return self._value


class EventLoop(Thread):
    """
    Used to send telemetry data to dev-mode extension, in a separate thread.
    The thread executes an asyncio loop.
    Communication between the main thread and the EventLoop thread:
    1. Main thread can add spans and captured events to the buffer.
    2. Main thread can schedule a task to be executed in the asyncio loop.
    3. Main thread can flush the buffer.
    4. Main thread can stop the asyncio loop.
    """

    def __init__(self, start_event):
        super().__init__()

        self._loop = None
        self._event = start_event  # when the thread starts, the event will be signalled
        self._counter = SynchronizedCounter()  # used to detect if all tasks finished
        self._buffered_data = (
            ThreadSafeBuffer()
        )  # used to buffer spans and captured events
        self._scheduled_task = SynchronizedVariable()
        self._has_active_schedule = False

    async def _send_telemetry(self, name: str, body: bytes):
        try:
            await send_async(name, body)
        finally:
            # signal that the task is finished
            self._counter.decrement()

    def send_telemetry(self, name: str, body: bytes):
        """
        Send the data to the telemetry endpoint, this is not blocking.
        It schedules a task to be executed in the asyncio loop.
        """

        def _add_task(coro):
            asyncio.create_task(coro)

        # signal that a new task is added
        self._counter.increment()
        coro = self._send_telemetry(name, body)
        self._loop.call_soon_threadsafe(_add_task, coro)

    def _send_data(self):
        self._scheduled_task.set(None)
        self._has_active_schedule = False
        (spans, captured_events) = self._buffered_data.get_all()

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
                },
            },
            "spans": [_convert_span(s) for s in spans],
            "events": [e.to_protobuf_dict() for e in captured_events],
            "customTags": json.dumps(serverlessSdk._custom_tags),
        }
        if not get_invocation_context():
            payload["spans"] = [
                s for s in payload["spans"] if s["name"] != "aws.lambda"
            ]

        self.send_telemetry("trace", bytes(to_trace_payload(payload)))

    def _schedule_eventually(self):
        """
        If there is no scheduled task, schedule one to be executed in the future.
        """
        if self._has_active_schedule:
            return

        def _schedule_for_later():
            self._scheduled_task.set(self._loop.call_later(0.05, self._send_data))

        self._has_active_schedule = True
        self._loop.call_soon_threadsafe(_schedule_for_later)

    def add_span(self, span):
        self._buffered_data.add_span(span)
        self._schedule_eventually()

    def add_captured_event(self, captured_event):
        self._buffered_data.add_captured_event(captured_event)
        self._schedule_eventually()

    def run(self):
        """
        Start the thread and the event loop.
        """
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.call_soon(self._event.set)
        self._loop.run_forever()

        # clean up resources
        self._loop.run_until_complete(close_session())

    def _terminate(self):
        """
        Signal the thread to stop, any remaining data will be flushed.
        """
        self.flush()
        self._loop.call_soon_threadsafe(self._loop.stop)
        self.join()

    def flush(self):
        """
        Flush any remaining data, blocks until all data is sent.
        """
        task = self._scheduled_task.get()
        if task:
            task.cancel()
        self._loop.call_soon_threadsafe(self._send_data)
        import time

        while len(self._buffered_data):
            time.sleep(0.01)


def get_event_loop() -> EventLoop:
    event = Event()
    event_loop = EventLoop(event)
    event_loop.start()
    event.wait()
    return event_loop
