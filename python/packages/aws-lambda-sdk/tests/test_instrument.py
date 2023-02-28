from __future__ import annotations

import pytest

from . import compare_handlers
from serverless_aws_lambda_sdk.base import Handler, Instrument


@pytest.fixture
def instrument() -> Instrument:
    from serverless_aws_lambda_sdk.instrument import instrument

    return instrument


def test_instrument_exists_and_importable():
    try:
        from serverless_aws_lambda_sdk.instrument import instrument

    except ImportError as e:
        raise AssertionError("`instrument` not found") from e


def test_instrument_is_callable(instrument: Instrument):
    assert callable(instrument)


def test_instrument_wraps_callable(instrument: Instrument):
    def example():
        pass

    result = instrument(example)
    assert callable(result)


def test_instrumented_callable_behaves_like_original(instrument: Instrument):
    def example(a: int, b: int) -> int:
        return a + b

    instrumented = instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables(instrument: Instrument):
    class Example:
        def __call__(self, a: int, b: int) -> int:
            return a + b

    example: Handler = Example()
    instrumented: Handler = instrument(example)

    compare_handlers(example, instrumented)
