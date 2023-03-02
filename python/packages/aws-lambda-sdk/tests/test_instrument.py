from __future__ import annotations

import pytest

from . import compare_handlers, context


@pytest.fixture
def instrument(monkeypatch):
    monkeypatch.setenv("_SLS_PROCESS_START_TIME", "0")
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "test-function")
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_VERSION", "1")
    monkeypatch.setenv("SLS_ORG_ID", "test-org")
    from serverless_aws_lambda_sdk.instrument import instrument

    return instrument


def test_instrument_is_callable(instrument):
    assert callable(instrument)


def test_instrument_wraps_callable(instrument):
    def example(event, context):
        pass

    result = instrument(example)
    assert callable(result)
    result({}, context)


def test_instrumented_callable_behaves_like_original(instrument):
    def example(event, context) -> str:
        return context.aws_request_id

    instrumented = instrument(example)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables(instrument):
    class Example:
        def __call__(self, event, context) -> str:
            return context.aws_request_id

    example = Example()
    instrumented = instrument(example)

    compare_handlers(example, instrumented)
