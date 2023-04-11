import asyncio
import json
from threading import Thread, Event, Lock
import os
from .telemetry import send_async, close_session, open_session
from .sdk import serverlessSdk
from .invocation_context import get as get_invocation_context
from .payload_conversion import to_trace_payload
import builtins
import logging

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


class ScheduledTasks:
    def __init__(self):
        self._tasks = set()
        self._lock = Lock()

    def add(self, task: asyncio.Task):
        with self._lock:
            self._tasks.add(task)
        task.add_done_callback(lambda t: self.remove(t))

    def remove(self, task: asyncio.Task):
        with self._lock:
            self._tasks.remove(task)

    def get_all(self):
        with self._lock:
            return self._tasks.copy()


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
        self._buffered_data = (
            ThreadSafeBuffer()
        )  # used to buffer spans and captured events
        self._scheduled_tasks = ScheduledTasks()

    def send_telemetry(self, name: str, body: bytes):
        """
        Send the data to the telemetry endpoint, this is not blocking.
        It schedules a task to be executed in the asyncio loop.
        """

        def _add_task(coro):
            self._scheduled_tasks.add(asyncio.create_task(coro))

        coro = send_async(name, body)
        self._loop.call_soon_threadsafe(_add_task, coro)

    def _send_data(self):
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
                    "runtime": "python",
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

        self.send_telemetry("trace", to_trace_payload(payload).SerializeToString())

    def _schedule_eventually(self):
        """
        If there is no scheduled task, schedule one to be executed in the future.
        """

        def _schedule_for_later():
            self._loop.call_later(0.05, self._send_data)

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

        # make sure session is open before running the main loop
        self._loop.run_until_complete(open_session())

        # signal that the thread is ready
        self._loop.call_soon(self._event.set)

        # this will lock the asyncio thread, until the main thread signals to stop
        self._loop.run_forever()

        # at this point, main thread signalled stop, main loop ended.
        # complete remaining tasks as well as flushing the buffer
        self._send_data()
        self._loop.run_until_complete(self._loop.shutdown_asyncgens())
        tasks = self._scheduled_tasks.get_all()
        if tasks:
            self._loop.run_until_complete(asyncio.gather(*tasks))

        # clean up resources
        self._loop.run_until_complete(close_session())

    def terminate(self):
        """
        Signal the thread to stop, any remaining data will be flushed.
        """
        self._loop.call_soon_threadsafe(self._loop.stop)
        self.join()


def get_event_loop() -> EventLoop:
    event = Event()
    event_loop = EventLoop(event)
    event_loop.start()
    event.wait()
    return event_loop
