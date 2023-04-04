from __future__ import annotations
from time import sleep
import concurrent.futures
import asyncio
import random


def print_spans(root, length=100):
    # normalize start and end times within [0, length]
    offset = root.start_time
    for span in root.spans:
        span.end_time -= offset
        span.start_time -= offset
    scale = root.end_time
    for span in root.spans:
        span.start_time = int((span.start_time / scale) * length)
        span.end_time = int((span.end_time / scale) * length)

    for span in root.spans:
        beginning = " " * span.start_time
        middle = "*" * (span.end_time - span.start_time)
        print(f"{span.name.ljust(20, ' ')}: {beginning}{middle}")


def test_overlapping_spans_multithreaded(sdk):
    # given
    parallelism = 10

    def _create_span_and_sleep(index):
        sleep(0.01 * index)
        span = sdk._create_trace_span(f"child{index}")
        span.index = index
        sleep(0.01 * index)
        inner_span = sdk._create_trace_span(f"grandchild{index}")
        sleep(0.01 * index)
        inner_span.close()
        sleep(0.01 * index)
        span.close()

    root_span = sdk._create_trace_span("root")

    # when
    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [
            executor.submit(_create_span_and_sleep, i) for i in range(parallelism)
        ]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    root_span.close()

    # then
    print_spans(root_span)

    assert len(root_span.sub_spans) == parallelism
    sub_spans = sorted(root_span.sub_spans, key=lambda span: span.index)
    for idx, sub_span in enumerate(sub_spans):
        assert sub_span.name == f"child{idx}"
        assert len(sub_span.sub_spans) == 1
        assert sub_span.sub_spans[0].name == f"grandchild{idx}"


def test_overlapping_spans_async(sdk):
    # given
    parallelism = 10

    async def _create_span_and_sleep(index):
        await asyncio.sleep(0.05)
        span = sdk._create_trace_span(f"child{index}")
        await asyncio.sleep(0.05)
        inner_span = sdk._create_trace_span(f"grandchild{index}")
        await asyncio.sleep(0.05)
        inner_span.close()
        await asyncio.sleep(0.05)
        span.close()

    root_span = sdk._create_trace_span("root")

    # when
    async def _run():
        await asyncio.gather(*[_create_span_and_sleep(i) for i in range(parallelism)])

    asyncio.run(_run())

    root_span.close()

    # then
    print_spans(root_span)

    assert len(root_span.sub_spans) == parallelism
    sub_spans = sorted(root_span.sub_spans, key=lambda span: span.name)
    for idx, sub_span in enumerate(sub_spans):
        assert sub_span.name == f"child{idx}"
        assert len(sub_span.sub_spans) == 1
        assert sub_span.sub_spans[0].name == f"grandchild{idx}"


def test_overlapping_spans_async_with_multithreading(sdk):
    # given
    parallelism = 5

    async def _create_span_and_sleep(thread_index, async_index):
        await asyncio.sleep(0.05)
        span = sdk._create_trace_span(f"thread{thread_index}.async{async_index}")
        span.index = thread_index * 100 + async_index + 1
        await asyncio.sleep(0.05)
        inner_span = sdk._create_trace_span(
            f"thread{thread_index}.async{async_index}.child"
        )
        await asyncio.sleep(0.05)
        inner_span.close()
        await asyncio.sleep(0.05)
        span.close()

    root_span = sdk._create_trace_span("root")

    # when
    async def _run(thread_index):
        await asyncio.sleep(0.1)
        span = sdk._create_trace_span(f"thread{thread_index}")
        span.index = thread_index * 100
        await asyncio.gather(
            *[_create_span_and_sleep(thread_index, i) for i in range(parallelism)]
        )
        await asyncio.sleep(0.1)
        span.close()

    def _thread_run(index):
        asyncio.run(_run(index))

    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_thread_run, i) for i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    root_span.close()

    # then
    print_spans(root_span)
    assert len(root_span.sub_spans) == parallelism
    sub_spans = sorted(root_span.sub_spans, key=lambda span: span.index)
    for idx, sub_span in enumerate(sub_spans):
        assert sub_span.name == f"thread{idx}"
        assert len(sub_span.sub_spans) == parallelism
        for sub_idx, sub_sub_span in enumerate(sub_span.sub_spans):
            assert sub_sub_span.name == f"thread{idx}.async{sub_idx}"
            assert len(sub_sub_span.sub_spans) == 1


def test_captured_events_async_with_multithreading(sdk):
    # given
    parallelism = 5
    captured_events = []

    def _captured_event_handler(captured_event):
        captured_events.append(captured_event)

    sdk._event_emitter.on("captured-event", _captured_event_handler)

    async def _create_captured_event_and_sleep(thread_index, async_index):
        await asyncio.sleep(0.05 + random.random() * 0.05)
        sdk.capture_error(
            Exception("Captured error"),
            tags={"threadIndex": thread_index, "asyncIndex": async_index},
        )

    # when
    async def _run(thread_index):
        await asyncio.sleep(0.1 + random.random() * 0.1)
        await asyncio.gather(
            *[
                _create_captured_event_and_sleep(thread_index, i)
                for i in range(parallelism)
            ]
        )
        await asyncio.sleep(0.1 + random.random() * 0.1)

    def _thread_run(index):
        asyncio.run(_run(index))

    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_thread_run, i) for i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    # then
    assert len(captured_events) == parallelism * parallelism
    for thread_index in range(parallelism):
        events = [
            event
            for event in captured_events
            if event.custom_tags["threadIndex"] == thread_index
        ]
        assert len(events) == parallelism
        events = sorted(events, key=lambda event: event.custom_tags["asyncIndex"])
        for async_index in range(parallelism):
            assert events[async_index].custom_tags["asyncIndex"] == async_index
