from __future__ import annotations

import os

from typing_extensions import Final
from pathlib import Path

from serverless_aws_lambda_sdk.exceptions import HandlerNotFound
from serverless_aws_lambda_sdk.internal_extension.base import Env

from .fixtures import (
    SUBMODULE_HANDLER,
    SUCCESS_HANDLER,
    ERROR_HANDLER,
    UNIMPORTABLE_HANDLER,
    SYNTAX_ERROR_HANDLER,
)
import importlib
import pytest


HANDLER_MODULE_DIR: Final[str] = str(Path(__file__).parent.resolve())


def test_raises_exception_when_handler_is_not_set(monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    # when
    with pytest.raises(HandlerNotFound):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_function_does_not_exist(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.invalid"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.invalid"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "invalid"
    monkeypatch.setattr(os, "environ", env)

    # when
    with pytest.raises(Exception):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_module_has_an_error(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{UNIMPORTABLE_HANDLER}.foo"
    env[Env.HANDLER_MODULE_BASENAME] = f"{UNIMPORTABLE_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{UNIMPORTABLE_HANDLER}.foo"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "foo"
    monkeypatch.setattr(os, "environ", env)

    # when
    with pytest.raises(ImportError):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_module_has_a_syntax_error(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{SYNTAX_ERROR_HANDLER}.foo"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SYNTAX_ERROR_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SYNTAX_ERROR_HANDLER}.foo"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "foo"
    monkeypatch.setattr(os, "environ", env)

    # when
    with pytest.raises(SyntaxError):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_can_instrument_handler(monkeypatch):
    # given
    env = os.environ
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)
    response = wrapper.handler({}, {})

    # then
    assert response == "ok", "handler return should not be tampered with"


def test_can_instrument_handler_with_submodule(monkeypatch):
    # given
    env = os.environ
    env[Env.HANDLER] = f"{SUBMODULE_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUBMODULE_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUBMODULE_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)
    response = wrapper.handler({}, {})

    # then
    assert response == "ok", "handler return should not be tampered with"


def test_can_instrument_handler_when_handler_fails(monkeypatch):
    # given
    env = os.environ
    env[Env.HANDLER] = f"{ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{ERROR_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)

    with pytest.raises(Exception, match=r"Stop"):
        wrapper.handler({}, {})
