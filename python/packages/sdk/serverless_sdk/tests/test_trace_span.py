import pytest
from timeit import default_timer
import json
from serverless_sdk.span.trace import TraceSpan


def timer():
    return int(default_timer() * 1000000000)


# root span that lives throughout the test session
@pytest.fixture(scope="session")
def root_span():
    span = TraceSpan("test")
    yield span
    span.close()


def test_root_span(root_span: TraceSpan):
    assert type(root_span.trace_id) == str, "should automatically generate `trace_id`"
    assert type(root_span.id) == str, "should automatically generate `id`"
    assert (
        type(root_span.start_time) == int
    ), "should automatically generate `start_time`"


def test_sub_span(root_span: TraceSpan):
    # given
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


def test_span_init_start_time():
    # given
    start_time = timer()

    # when
    span = TraceSpan("child", start_time=start_time).close()

    # then
    assert span.start_time == start_time, "should support injection of `start_time`"


def test_span_init_tags():
    # given
    tags = {"foo": "bar"}

    # when
    span = TraceSpan("child", tags=tags).close()

    # then
    assert span.tags == tags, "should support initial `tags`"


def test_span_init_end_time():
    # given
    span = TraceSpan("child")
    end_time = timer()

    # when
    span.close(end_time=end_time)

    # then
    assert span.end_time == end_time, "should support injection of `end_time`"


def test_span_init_input():
    # given
    input = "foo"

    # when
    span = TraceSpan("child", input=input).close()

    # then
    assert span.input == input, "should support `input`"


def test_span_stringify_to_json():
    # given
    child_span = TraceSpan("child")
    child_span.tags["foo"] = 12
    child_span.close()

    # when
    json_value = json.loads(child_span.toJSON())

    # then
    assert json_value == {
        "traceId": child_span.trace_id,
        "id": child_span.id,
        "name": child_span.name,
        "startTime": child_span.start_time,
        "endTime": child_span.end_time,
        "input": child_span.input,
        "output": child_span.output,
        "tags": child_span.tags,
    }, "should stringify to JSON"


def test_span_protobuf():
    # given
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
    child_span.close()

    # when
    proto_json = child_span.to_protobuf_dict()

    # then
    assert proto_json == {
        "traceId": child_span.trace_id,
        "parentSpanId": child_span.parent_span.id,
        "id": child_span.id,
        "name": child_span.name,
        "startTimeUnixNano": child_span.start_time,
        "endTimeUnixNano": child_span.end_time,
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
    }, "should stringify to JSON"


def test_creation_of_immediate_descendant_spans():
    # given
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


def test_leaf_span():
    # given
    span = TraceSpan("child").close()

    # then
    assert list(span.spans) == [span], "should resolve just self when no subspans"


def test_spans():
    # given
    span = TraceSpan("child")
    sub_span = TraceSpan("subchild")
    sub_sub_span = TraceSpan("subsubchild").close()
    sub_span.close()
    span.close()

    # then
    assert not set(span.spans) ^ set([span, sub_span, sub_sub_span])


def test_span_closure():
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
