def test_can_import_trace_span():
    try:
        from ..trace_span import TraceSpan

    except ImportError:
        raise AssertionError("Cannot import TraceSpan")

