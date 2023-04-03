from sls_sdk.lib.timing import to_protobuf_epoch_timestamp
import time


def test_protobuf_epoch_timestamp_conversion():
    # given
    start = time.time_ns()
    time.sleep(0.5)

    point_in_time = time.perf_counter_ns()

    # when
    time.sleep(0.5)
    end = time.time_ns()

    point_in_time = to_protobuf_epoch_timestamp(point_in_time)

    # then
    assert point_in_time > start and point_in_time < end


def test_protobuf_epoch_timestamp_none():
    # given
    point_in_time = None

    # when
    point_in_time = to_protobuf_epoch_timestamp(point_in_time)

    # then
    assert point_in_time is None
