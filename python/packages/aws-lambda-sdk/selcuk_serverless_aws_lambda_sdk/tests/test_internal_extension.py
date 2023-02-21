from __future__ import annotations

from os import environ
from typing import Callable

import pytest
from typing_extensions import Final

from . import compare_handlers
from .example import callable_obj, env_handler, handler as example
from ..base import Env, Handler


EXAMPLE_MODULE: Final[str] = "selcuk_serverless_aws_lambda_sdk.tests.example"

HANDLER: Final[str] = f"{EXAMPLE_MODULE}.handler"
HANDLER_PATH: Final[str] = "selcuk_serverless_aws_lambda_sdk/tests/example.handler"
CLS_HANDLER: Final[str] = f"{EXAMPLE_MODULE}.callable_obj"
ENV_HANDLER: Final[str] = f"{EXAMPLE_MODULE}.env_handler"


@pytest.fixture
def wrapper() -> Callable:
    from ..internal_extension.wrapper import get_instrumented_handler

    return get_instrumented_handler


def test_can_instrument_module(wrapper):
    handler = wrapper(HANDLER)
    assert callable(handler)


def test_can_instrument_path(wrapper):
    handler = wrapper(HANDLER_PATH)
    assert callable(handler)


def test_wrapped_callable_behaves_like_original(wrapper):
    instrumented: Handler = wrapper(HANDLER)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables(wrapper):
    example: Handler = callable_obj
    instrumented: Handler = wrapper(CLS_HANDLER)

    compare_handlers(example, instrumented)


def test_instrument_works_with_env_vars(wrapper):
    environ[Env.HANDLER] = ENV_HANDLER

    example: Handler = env_handler
    instrumented: Handler = wrapper(handler=None)

    compare_handlers(example, instrumented)
