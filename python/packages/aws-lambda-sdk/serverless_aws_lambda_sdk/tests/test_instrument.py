from __future__ import annotations

import pytest

from . import compare_handlers, ensure_globals, reset_globals
from ..base import Handler, Instrument


@pytest.fixture
def instrument() -> Instrument:
    from ..instrument import instrument

    return instrument


def test_instrument_exists_and_importable():
    try:
        from ..instrument import instrument

    except ImportError as e:
        raise AssertionError("`instrument` not found") from e


def test_instrument_is_callable(instrument: Instrument):
    assert callable(instrument)


@ensure_globals
def test_instrument_wraps_callable(instrument: Instrument):
    def example(event, context):
        pass

    result = instrument(example)
    assert callable(result)


@ensure_globals
def test_instrumented_callable_behaves_like_original(instrument: Instrument):
    def example(event, context) -> str:
        return "Hello World"

    instrumented = instrument(example)

    compare_handlers(example, instrumented)


@ensure_globals
def test_instrument_works_with_all_callables(instrument: Instrument):
    class Example:
        def __call__(self, event, context) -> str:
            return "Hello World"

    example: Handler = Example()
    instrumented: Handler = instrument(example)

    compare_handlers(example, instrumented)
