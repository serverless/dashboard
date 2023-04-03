import pytest
import sys
from pathlib import Path
import os
from unittest.mock import MagicMock
import importlib


@pytest.fixture()
def exec_wrapper_main():
    import serverless_aws_lambda_sdk.internal_extension.exec_wrapper

    importlib.reload(serverless_aws_lambda_sdk.internal_extension.exec_wrapper)
    yield serverless_aws_lambda_sdk.internal_extension.exec_wrapper.main


@pytest.fixture()
def wrapper_patch(monkeypatch):
    monkeypatch.setenv("LAMBDA_TASK_ROOT", str(Path(__file__).parent.resolve()))
    monkeypatch.setenv("SLS_ORG_ID", "test-org")
    monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    monkeypatch.setenv("LAMBDA_RUNTIME_DIR", "/var/runtime")
    yield monkeypatch


@pytest.fixture()
def wrapper_patch_no_sls(monkeypatch):
    monkeypatch.setenv("LAMBDA_TASK_ROOT", str(Path(__file__).parent.resolve()))
    monkeypatch.delenv("SLS_ORG_ID", raising=False)
    monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    monkeypatch.setenv("LAMBDA_RUNTIME_DIR", "/var/runtime")
    yield monkeypatch


def test_exec_wrapper_succeeds(wrapper_patch, exec_wrapper_main):
    # given
    env = dict(os.environ)
    wrapper_patch.setattr(os, "environ", env)
    system_mock = MagicMock()
    wrapper_patch.setattr(os, "system", system_mock)

    lambda_handler = "success.handler"

    wrapper_patch.setenv("_HANDLER", lambda_handler)

    initial_sys_path = sys.path.copy()

    # when
    exec_wrapper_main()

    # then
    assert os.environ["_ORIGIN_HANDLER"] == lambda_handler
    assert (
        os.environ["_HANDLER"]
        == "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"
    )
    assert sys.path == initial_sys_path
    system_mock.assert_called_once()


def test_exec_wrapper_noops_if_sls_env_variable_is_missing(
    wrapper_patch_no_sls,
    exec_wrapper_main,
):
    # given
    env = dict(os.environ)
    wrapper_patch_no_sls.setattr(os, "environ", env)
    system_mock = MagicMock()
    wrapper_patch_no_sls.setattr(os, "system", system_mock)

    lambda_handler = "success.handler"

    wrapper_patch_no_sls.setenv("_HANDLER", lambda_handler)

    initial_sys_path = sys.path.copy()

    # when
    exec_wrapper_main()

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert sys.path == initial_sys_path
    system_mock.assert_called_once()


def test_exec_wrapper_noops_if_handler_not_specified(wrapper_patch, exec_wrapper_main):
    # given
    env = dict(os.environ)
    wrapper_patch.setattr(os, "environ", env)
    system_mock = MagicMock()
    wrapper_patch.setattr(os, "system", system_mock)

    lambda_handler = "success"

    wrapper_patch.setenv("_HANDLER", lambda_handler)

    initial_sys_path = sys.path.copy()

    # when
    exec_wrapper_main()

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert sys.path == initial_sys_path
    system_mock.assert_called_once()


def test_exec_wrapper_noops_if_builtin_module(wrapper_patch, exec_wrapper_main):
    # given
    env = dict(os.environ)
    wrapper_patch.setattr(os, "environ", env)
    system_mock = MagicMock()
    wrapper_patch.setattr(os, "system", system_mock)

    lambda_handler = "builtins.print"

    wrapper_patch.setenv("_HANDLER", lambda_handler)

    initial_sys_path = sys.path.copy()

    # when
    exec_wrapper_main()

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert sys.path == initial_sys_path
    system_mock.assert_called_once()


def test_exec_wrapper_noops_if_module_does_not_exist(wrapper_patch, exec_wrapper_main):
    # given
    env = dict(os.environ)
    wrapper_patch.setattr(os, "environ", env)
    system_mock = MagicMock()
    wrapper_patch.setattr(os, "system", system_mock)

    lambda_handler = "nonexistent.module"

    wrapper_patch.setenv("_HANDLER", lambda_handler)

    initial_sys_path = sys.path.copy()

    # when
    exec_wrapper_main()

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert sys.path == initial_sys_path
    system_mock.assert_called_once()
