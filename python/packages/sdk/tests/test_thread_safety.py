from __future__ import annotations
from time import sleep
import asyncio
import random
import pytest
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response

SMALL_REQUEST_PAYLOAD = b"a"
SMALL_RESPONSE_PAYLOAD = b"r"


def print_spans(root, length=100):
    print("\n")
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


def test_overlapping_spans_multithreaded(instrumented_sdk):
    # given
    import concurrent.futures

    parallelism = 10

    def _create_span_and_sleep(index):
        sleep(0.01 * index)
        span = instrumented_sdk._create_trace_span(f"child{index}")
        span.index = index
        sleep(0.01 * index)
        inner_span = instrumented_sdk._create_trace_span(f"grandchild{index}")
        sleep(0.01 * index)
        inner_span.close()
        sleep(0.01 * index)
        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

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
        assert sub_span.parent_span is root_span
        assert sub_span.name == f"child{idx}"
        assert len(sub_span.sub_spans) == 1
        assert sub_span.sub_spans[0].name == f"grandchild{idx}"
        assert sub_span.sub_spans[0].parent_span is sub_span


def test_overlapping_spans_async(instrumented_sdk):
    # given
    parallelism = 10

    async def _create_span_and_sleep(index):
        await asyncio.sleep(0.05)
        span = instrumented_sdk._create_trace_span(f"child{index}")
        await asyncio.sleep(0.05)
        inner_span = instrumented_sdk._create_trace_span(f"grandchild{index}")
        await asyncio.sleep(0.05)
        inner_span.close()
        await asyncio.sleep(0.05)
        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

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
        assert sub_span.parent_span is root_span
        assert sub_span.name == f"child{idx}"
        assert len(sub_span.sub_spans) == 1
        assert sub_span.sub_spans[0].name == f"grandchild{idx}"
        assert sub_span.sub_spans[0].parent_span is sub_span


def test_overlapping_spans_async_with_multithreading(instrumented_sdk):
    # given
    import concurrent.futures

    parallelism = 5

    async def _create_span_and_sleep(thread_index, async_index):
        await asyncio.sleep(0.05)
        span = instrumented_sdk._create_trace_span(
            f"thread{thread_index}.async{async_index}"
        )
        span.index = thread_index * 100 + async_index + 1
        await asyncio.sleep(0.05)
        inner_span = instrumented_sdk._create_trace_span(
            f"thread{thread_index}.async{async_index}.child"
        )
        await asyncio.sleep(0.05)
        inner_span.close()
        await asyncio.sleep(0.05)
        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

    # when
    async def _run(thread_index):
        await asyncio.sleep(0.1)
        span = instrumented_sdk._create_trace_span(f"thread{thread_index}")
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
        assert sub_span.parent_span is root_span
        assert sub_span.name == f"thread{idx}"
        assert len(sub_span.sub_spans) == parallelism
        for sub_idx, sub_sub_span in enumerate(sub_span.sub_spans):
            assert sub_sub_span.parent_span is sub_span
            assert sub_sub_span.name == f"thread{idx}.async{sub_idx}"
            assert len(sub_sub_span.sub_spans) == 1


def test_overlapping_spans_async_with_multithreading_large_scale(instrumented_sdk):
    # given
    import concurrent.futures

    parallelism = 10
    scale = 1000

    async def _create_span_and_sleep(thread_index, async_index):
        await asyncio.sleep(0)
        span = instrumented_sdk._create_trace_span(
            f"thread{thread_index}.async{async_index}"
        )
        span.index = thread_index * scale * 10 + async_index + 1
        await asyncio.sleep(0)
        inner_span = instrumented_sdk._create_trace_span(
            f"thread{thread_index}.async{async_index}.child"
        )
        await asyncio.sleep(0)
        inner_span.close()
        await asyncio.sleep(0)
        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

    # when
    async def _run(thread_index):
        await asyncio.sleep(0.1)
        span = instrumented_sdk._create_trace_span(f"thread{thread_index}")
        span.index = thread_index * scale * 10
        await asyncio.gather(
            *[_create_span_and_sleep(thread_index, i) for i in range(scale)]
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
        assert sub_span.parent_span is root_span
        assert sub_span.name == f"thread{idx}"
        assert len(sub_span.sub_spans) == scale
        for sub_idx, sub_sub_span in enumerate(sub_span.sub_spans):
            assert sub_sub_span.parent_span is sub_span
            assert sub_sub_span.name == f"thread{idx}.async{sub_idx}"
            assert len(sub_sub_span.sub_spans) == 1


@pytest.mark.parametrize("is_error", [True, False])
def test_captured_events_async_with_multithreading(instrumented_sdk, is_error):
    # given
    import concurrent.futures

    parallelism = 5
    scale = 100
    captured_events = []

    def _captured_event_handler(captured_event):
        captured_events.append(captured_event)

    instrumented_sdk._event_emitter.on("captured-event", _captured_event_handler)

    async def _create_captured_event_and_sleep(thread_index, async_index):
        await asyncio.sleep(0)
        if is_error:
            instrumented_sdk.capture_error(
                Exception("Captured error"),
                tags={"threadIndex": thread_index, "asyncIndex": async_index},
            )
        else:
            instrumented_sdk.capture_warning(
                "Captured warning",
                tags={"threadIndex": thread_index, "asyncIndex": async_index},
            )

    # when
    async def _run(thread_index):
        await asyncio.sleep(0.1 + random.random() * 0.1)
        await asyncio.gather(
            *[_create_captured_event_and_sleep(thread_index, i) for i in range(scale)]
        )
        await asyncio.sleep(0.1 + random.random() * 0.1)

    def _thread_run(index):
        asyncio.run(_run(index))

    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_thread_run, i) for i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    # then
    assert len(captured_events) == parallelism * scale
    for thread_index in range(parallelism):
        events = [
            event
            for event in captured_events
            if event.custom_tags["threadIndex"] == thread_index
        ]
        assert len(events) == scale
        events = sorted(events, key=lambda event: event.custom_tags["asyncIndex"])
        for async_index in range(scale):
            assert events[async_index].custom_tags["asyncIndex"] == async_index


def test_set_tag_multithreaded(instrumented_sdk):
    # given
    import concurrent.futures

    parallelism = 10
    scale = 10000

    def _set_tag_and_sleep(thread_index):
        sleep(0.05)
        for i in range(scale):
            unique_value = thread_index * scale * 10 + i
            instrumented_sdk.set_tag(f"tag{unique_value}", unique_value)

    # when
    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_set_tag_and_sleep, i) for i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    # then
    assert len(instrumented_sdk._custom_tags) == parallelism * scale

    # given
    def _del_tag_and_sleep(thread_index):
        sleep(0.05)
        for i in range(scale):
            unique_value = thread_index * scale * 10 + i
            del instrumented_sdk._custom_tags[f"tag{unique_value}"]

    # when
    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_del_tag_and_sleep, i) for i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    # then
    assert len(instrumented_sdk._custom_tags) == 0


@pytest.mark.parametrize(
    "request_body,response_body",
    [
        (SMALL_REQUEST_PAYLOAD, SMALL_RESPONSE_PAYLOAD),
    ],
)
def test_instrument_requests_multithreaded(
    instrumented_sdk, httpserver: HTTPServer, request_body, response_body
):
    # given
    import concurrent.futures

    def handler(request: Request):
        return Response(response_body)

    httpserver.expect_request("/foo/bar").respond_with_handler(handler)

    root = instrumented_sdk._create_trace_span("rootspan")
    assert len(root.spans) == 1

    parallelism = 5

    # when
    import requests

    def _run():
        requests.get(
            httpserver.url_for("/foo/bar?baz=qux"),
            headers={"User-Agent": "foo"},
            data=request_body,
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=parallelism) as executor:
        futures = [executor.submit(_run) for _i in range(parallelism)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    # then
    assert len(root.spans) == parallelism + 1
    for span in root.spans[1:]:
        assert span.name == "python.http.request"
        assert (
            span.tags.items()
            >= dict(
                {
                    "http.method": "GET",
                    "http.protocol": "HTTP/1.1",
                    "http.host": f"127.0.0.1:{httpserver.port}",
                    "http.path": "/foo/bar",
                    "http.query_parameter_names": ["baz"],
                    "http.status_code": 200,
                }
            ).items()
        )
        assert "User-Agent" in span.tags["http.request_header_names"]


def test_overlapping_spans_multithreaded_hierarchy_plain(instrumented_sdk):
    # given
    import threading

    def _create_grandchild_span():
        span = instrumented_sdk._create_trace_span("grandchild")
        span.close()

    def _create_child_span():
        span = instrumented_sdk._create_trace_span("child")
        thread = threading.Thread(target=_create_grandchild_span)
        thread.start()
        thread.join()

        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

    # when
    thread = threading.Thread(target=_create_child_span)
    thread.start()
    thread.join()

    root_span.close()

    # then
    assert len(root_span.spans) == 3
    (root, child, grandchild) = root_span.spans
    assert root.name == "root"
    assert child.name == "child"
    assert grandchild.name == "grandchild"
    assert root.parent_span is None
    assert child.parent_span == root
    assert grandchild.parent_span == child


def test_overlapping_spans_multithreaded_hierarchy_thread_pool_executor(
    instrumented_sdk,
):
    # given
    import concurrent.futures

    def _create_grandchild_span(parent_index, index):
        span = instrumented_sdk._create_trace_span(
            f"child{parent_index}grandchild{index}"
        )
        span.close()

    def _create_child_span(index):
        span = instrumented_sdk._create_trace_span(f"child{index}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(_create_grandchild_span, index, i) for i in range(2)
            ]
            for future in concurrent.futures.as_completed(futures):
                assert future.exception() is None

        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

    # when
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(_create_child_span, i) for i in range(2)]
        for future in concurrent.futures.as_completed(futures):
            assert future.exception() is None

    root_span.close()

    # then
    assert len(root_span.spans) == 7
    root = [span for span in root_span.spans if span.name == "root"][0]
    child0 = [span for span in root_span.spans if span.name == "child0"][0]
    child1 = [span for span in root_span.spans if span.name == "child1"][0]
    child0grandchild0 = [
        span for span in root_span.spans if span.name == "child0grandchild0"
    ][0]
    child0grandchild1 = [
        span for span in root_span.spans if span.name == "child0grandchild1"
    ][0]
    child1grandchild0 = [
        span for span in root_span.spans if span.name == "child1grandchild0"
    ][0]
    child1grandchild1 = [
        span for span in root_span.spans if span.name == "child1grandchild1"
    ][0]
    assert root.parent_span is None
    assert child0.parent_span is root
    assert child1.parent_span is root
    assert child0grandchild0.parent_span is child0
    assert child0grandchild1.parent_span is child0
    assert child1grandchild0.parent_span is child1
    assert child1grandchild1.parent_span is child1


def test_overlapping_spans_async_hierarchy(instrumented_sdk):
    # given
    async def _create_child_span():
        span = instrumented_sdk._create_trace_span("child")

        async def _create_grandchild_span():
            span = instrumented_sdk._create_trace_span("grandchild")
            span.close()

        await _create_grandchild_span()
        span.close()

    root_span = instrumented_sdk._create_trace_span("root")

    # when
    async def _run():
        await _create_child_span()

    asyncio.run(_run())

    root_span.close()

    # then
    assert len(root_span.spans) == 3
    (root, child, grandchild) = root_span.spans
    assert root.name == "root"
    assert child.name == "child"
    assert grandchild.name == "grandchild"
    assert root.parent_span is None
    assert child.parent_span == root
    assert grandchild.parent_span == child
