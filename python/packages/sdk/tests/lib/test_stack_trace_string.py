import traceback
from sls_sdk.lib.stack_trace_string import resolve


def test_resolve_stack_trace_string_from_error():
    # given
    error = None

    def func():
        raise Exception("error")

    # when
    try:
        func()
    except Exception as ex:
        error = ex
        stack_trace = resolve(ex)

    # then
    assert stack_trace == "".join(
        traceback.format_exception(
            etype=type(error), value=error, tb=error.__traceback__
        )
    )


def test_resolve_stack_trace_string_from_current_stack():
    # given

    # simulate the use case for sdk.capture_error call chain
    def func():
        def func2():
            return resolve()

        return func2()

    # when
    stack_trace = func()

    # then
    assert "stack_trace = func()" in [line for line in stack_trace.split("  File")][-1]
