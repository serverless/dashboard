import time
import json
from unittest.mock import patch, call


def test_root_span(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    # when
    root_span = TraceSpan("root")

    # then
    assert type(root_span.trace_id) == str, "should automatically generate `trace_id`"
    assert type(root_span.id) == str, "should automatically generate `id`"
    assert (
        type(root_span.start_time) == int
    ), "should automatically generate `start_time`"


def test_sub_span(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    root_span = TraceSpan("root")
    child_span = TraceSpan("child")

    # when
    child_span.close()

    # then
    assert (
        child_span.trace_id == root_span.trace_id
    ), "should expose `trace_id` of a root span"
    assert type(child_span.id) == str, "should automatically generate `id`"
    assert child_span.id != root_span.id, "should have a unique `id`"
    assert (
        type(child_span.start_time) == int
    ), "should automatically generate `start_time`"
    assert (
        child_span.start_time != root_span.start_time
    ), "should have a different `start_time`"
    assert child_span.name == "child", "should expose `name`"
    assert child_span in root_span.sub_spans


def test_span_init_start_time(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    start_time = time.perf_counter_ns()

    # when
    span = TraceSpan("child", start_time=start_time).close()

    # then
    assert span.start_time == start_time, "should support injection of `start_time`"


def test_span_init_tags(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    tags = {"foo": "bar"}

    # when
    span = TraceSpan("child", tags=tags).close()

    # then
    assert span.tags == tags, "should support initial `tags`"


def test_span_init_end_time(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    span = TraceSpan("child")
    end_time = time.perf_counter_ns()

    # when
    span.close(end_time=end_time)

    # then
    assert span.end_time == end_time, "should support injection of `end_time`"


def test_span_init_input(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    input = "foo"

    # when
    span = TraceSpan("child", input=input).close()

    # then
    assert span.input == input, "should support `input`"


def test_span_protobuf(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan
    from sls_sdk.lib.timing import to_protobuf_epoch_timestamp

    parent_span = TraceSpan("parent")
    child_span = TraceSpan("child")
    child_span.input = "some input"
    child_span.output = "some output"
    child_span.tags["toptag"] = "1"
    child_span.tags["top.nested"] = "2"
    child_span.tags["top.deep.nested"] = "3"
    child_span.tags["top_snake.deep_snake.nested_snake"] = "3"
    child_span.tags["some.boolean"] = True
    child_span.tags["some.number"] = 123
    child_span.tags["some.strings"] = ["foo", "bar"]
    child_span.tags["some.numbers"] = [12, 23]
    child_span.custom_tags["elo"] = "marko"
    child_span.close()

    # when
    proto_dict = child_span.to_protobuf_dict()

    # then
    assert proto_dict == {
        "traceId": child_span.trace_id,
        "parentSpanId": parent_span.id,
        "id": child_span.id,
        "name": child_span.name,
        "startTimeUnixNano": to_protobuf_epoch_timestamp(child_span.start_time),
        "endTimeUnixNano": to_protobuf_epoch_timestamp(child_span.end_time),
        "input": child_span.input,
        "output": child_span.output,
        "tags": {
            "toptag": "1",
            "top": {"nested": "2", "deep": {"nested": "3"}},
            "topSnake": {"deepSnake": {"nestedSnake": "3"}},
            "some": {
                "boolean": True,
                "number": 123,
                "strings": ["foo", "bar"],
                "numbers": [12, 23],
            },
        },
        "customTags": json.dumps({"elo": "marko"}),
    }, "should stringify to JSON"


def test_creation_of_immediate_descendant_spans(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    child_span = TraceSpan(
        "child", immediate_descendants=["grandchild", "grandgrandchild"]
    )

    # when
    grand_children = list(child_span.sub_spans)

    grand_child = grand_children[0]
    grand_grand_children = list(grand_child.sub_spans)

    grand_grand_child = grand_grand_children[0]

    # then
    assert [x.name for x in grand_children] == ["grandchild"]
    assert [x.name for x in grand_grand_children] == ["grandgrandchild"]
    assert grand_child.start_time == child_span.start_time
    assert grand_grand_child.start_time == child_span.start_time
    assert grand_grand_child.parent_span == grand_child
    assert grand_child.parent_span == child_span

    grand_grand_child.close()
    grand_child.close()
    child_span.close()


def test_leaf_span(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    span = TraceSpan("child").close()

    # then
    assert list(span.spans) == [span], "should resolve just self when no subspans"


def test_spans(sdk):
    # given
    from sls_sdk.lib.trace import TraceSpan

    span = TraceSpan("child")
    sub_span_1 = TraceSpan("subchild1")
    sub_sub_span = TraceSpan("subsubchild").close()
    sub_span_1.close()
    sub_span_2 = TraceSpan("subchild2")
    span.close()

    # then
    assert span.spans == [span, sub_span_1, sub_sub_span, sub_span_2]


def test_span_closure(sdk):
    from sls_sdk.lib.trace import TraceSpan
    from sls_sdk.lib.emitter import event_emitter

    with patch.object(event_emitter, "emit") as mock_emit:
        # given
        aws_lambda = TraceSpan(
            "aws.lambda", immediate_descendants=["aws.lambda.initialization"]
        )
        aws_lambda_initialization = next(iter(aws_lambda.sub_spans))
        aws_lambda_initialization.close()

        aws_lambda_invocation = TraceSpan("aws.lambda.invocation")

        # when
        aws_lambda_invocation.close()

        # then
        aws_lambda.close()

    mock_emit.assert_has_calls(
        [
            call("trace-span-close", aws_lambda_initialization),
            call("trace-span-close", aws_lambda_invocation),
            call("trace-span-close", aws_lambda),
        ]
    )


def test_root_span_reuse(sdk):
    # given
    from importlib import reload
    import sls_sdk.lib.trace

    reload(sls_sdk.lib.trace)
    from sls_sdk.lib.trace import TraceSpan

    span = TraceSpan("root")
    TraceSpan("child1").close()
    TraceSpan("child2").close()
    span.close()
    span.sub_spans.clear()
    del sls_sdk.lib.trace.root_span.end_time

    # when
    span.start_time = time.perf_counter_ns()
    TraceSpan("otherchild").close()
    sls_sdk.lib.trace.root_span.close()

    # then
    assert [x.name for x in sls_sdk.lib.trace.root_span.spans] == [
        "root",
        "otherchild",
    ]
    sls_sdk.lib.trace.root_span.sub_spans.clear()
