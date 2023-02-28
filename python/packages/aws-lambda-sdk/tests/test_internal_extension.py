from __future__ import annotations

import os

from typing_extensions import Final
from pathlib import Path

from serverless_aws_lambda_sdk.internal_extension.base import Env
import importlib

from .fixtures import (
    SUBMODULE_HANDLER,
    SUCCESS_HANDLER,
    NOT_CALLABLE_HANDLER,
)


SLS_ORG_ID: Final[str] = "foo-bar"
SLS_SDK_DEBUG: Final[str] = "1"


def test_can_initialize_runtime(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    env[Env.LAMBDA_TASK_ROOT] = str(Path(__file__).parent.resolve())
    env[Env.SLS_ORG_ID] = SLS_ORG_ID
    env[Env.SLS_SDK_DEBUG] = SLS_SDK_DEBUG
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert (
        env.get(Env.HANDLER)
        == "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"
    )
    assert env.get(Env.ORIGIN_HANDLER) == f"{SUCCESS_HANDLER}.handler"
    assert env.get(Env.HANDLER_MODULE_BASENAME) == f"{SUCCESS_HANDLER}"
    assert env.get(Env.HANDLER_BASENAME) == f"{SUCCESS_HANDLER}.handler"
    assert env.get(Env.HANDLER_FUNCTION_NAME) == "handler"
    assert env.get(Env.HANDLER_MODULE_DIR) == str(Path(__file__).parent.resolve())


def test_can_initialize_runtime_with_submodule(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{SUBMODULE_HANDLER}.handler"
    env[Env.LAMBDA_TASK_ROOT] = str(Path(__file__).parent.resolve())
    env[Env.SLS_ORG_ID] = SLS_ORG_ID
    env[Env.SLS_SDK_DEBUG] = SLS_SDK_DEBUG
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert (
        env.get(Env.HANDLER)
        == "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"
    )
    assert env.get(Env.ORIGIN_HANDLER) == f"{SUBMODULE_HANDLER}.handler"
    assert env.get(Env.HANDLER_MODULE_BASENAME) == f"{SUBMODULE_HANDLER}"
    assert env.get(Env.HANDLER_BASENAME) == f"{SUBMODULE_HANDLER}.handler"
    assert env.get(Env.HANDLER_FUNCTION_NAME) == "handler"
    assert env.get(Env.HANDLER_MODULE_DIR) == str(Path(__file__).parent.resolve())


def test_can_initialize_runtime_with_submodule_path(monkeypatch):
    # given
    handler = f"{SUBMODULE_HANDLER.replace('.', '/')}.handler"
    env = dict(os.environ)
    env[Env.HANDLER] = handler
    env[Env.LAMBDA_TASK_ROOT] = str(Path(__file__).parent.resolve())
    env[Env.SLS_ORG_ID] = SLS_ORG_ID
    env[Env.SLS_SDK_DEBUG] = SLS_SDK_DEBUG
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert (
        env.get(Env.HANDLER)
        == "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"
    )
    assert env.get(Env.ORIGIN_HANDLER) == handler
    assert env.get(Env.HANDLER_MODULE_BASENAME) == f"{SUBMODULE_HANDLER}"
    assert env.get(Env.HANDLER_BASENAME) == f"{SUBMODULE_HANDLER}.handler"
    assert env.get(Env.HANDLER_FUNCTION_NAME) == "handler"
    assert env.get(Env.HANDLER_MODULE_DIR) == str(Path(__file__).parent.resolve())


def test_noops_if_handler_is_not_defined(monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env


def test_noops_if_handler_is_not_valid(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = "invalid"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env


def test_noops_if_handler_is_builtin_module(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = "sys.path"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env


def test_noops_if_sls_org_id_missing(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env


def test_noops_if_handler_module_does_not_exist(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = "nonexistent.handler"
    env[Env.LAMBDA_TASK_ROOT] = str(Path(__file__).parent.resolve())
    env[Env.SLS_ORG_ID] = SLS_ORG_ID
    env[Env.SLS_SDK_DEBUG] = SLS_SDK_DEBUG
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env


def test_noops_if_handler_is_not_callable(monkeypatch):
    # given
    env = dict(os.environ)
    env[Env.HANDLER] = f"{NOT_CALLABLE_HANDLER}.handler"
    monkeypatch.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import base

    importlib.reload(base)
    base.initialize()

    # then
    assert Env.ORIGIN_HANDLER not in env
