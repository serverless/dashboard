from __future__ import annotations

from os import environ

from typing_extensions import Final

from . import compare_handlers
from .example import callable_obj, env_handler, handler as example
from ..base import Env, Handler
from ..internal_extension.wrapper import get_instrumented_handler


EXAMPLE_MODULE: Final[str] = "serverless_lambda_sdk.tests.example"

HANDLER: Final[str] = f"{EXAMPLE_MODULE}.handler"
HANDLER_PATH: Final[str] = "serverless_lambda_sdk/tests/example.handler"
CLS_HANDLER: Final[str] = f"{EXAMPLE_MODULE}.callable_obj"
ENV_HANDLER: Final[str] = f"{EXAMPLE_MODULE}.env_handler"


def test_can_instrument_module():
    handler = get_instrumented_handler(HANDLER)
    assert callable(handler)


def test_can_instrument_path():
    handler = get_instrumented_handler(HANDLER_PATH)
    assert callable(handler)


def test_wrapped_callable_behaves_like_original():
    instrumented: Handler = get_instrumented_handler(HANDLER)

    compare_handlers(example, instrumented)


def test_instrument_works_with_all_callables():
    example: Handler = callable_obj
    instrumented: Handler = get_instrumented_handler(CLS_HANDLER)

    compare_handlers(example, instrumented)


def test_instrument_works_with_env_vars():
    environ[Env.HANDLER] = ENV_HANDLER

    example: Handler = env_handler
    instrumented: Handler = get_instrumented_handler(handler=None)

    compare_handlers(example, instrumented)
