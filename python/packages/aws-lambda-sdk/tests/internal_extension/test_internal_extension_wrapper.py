from __future__ import annotations
import os
from typing_extensions import Final
from pathlib import Path

from .. import context
from ..fixtures import (
    SUBMODULE_HANDLER,
    SUCCESS_HANDLER,
    ERROR_HANDLER,
    UNHANDLED_ERROR_HANDLER,
    UNIMPORTABLE_HANDLER,
    SYNTAX_ERROR_HANDLER,
)
import importlib
import pytest
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Response


HANDLER_MODULE_DIR: Final[str] = str(Path(__file__).parent.resolve())


def test_raises_exception_when_handler_is_not_set(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.exceptions import HandlerNotFound

    env = dict(os.environ)
    reset_sdk.setattr(os, "environ", env)

    # when
    with pytest.raises(HandlerNotFound):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_function_does_not_exist(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = dict(os.environ)
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.invalid"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.invalid"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "invalid"
    reset_sdk.setattr(os, "environ", env)

    # when
    with pytest.raises(Exception):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_module_has_an_error(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = dict(os.environ)
    env[Env.HANDLER] = f"{UNIMPORTABLE_HANDLER}.foo"
    env[Env.HANDLER_MODULE_BASENAME] = f"{UNIMPORTABLE_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{UNIMPORTABLE_HANDLER}.foo"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "foo"
    reset_sdk.setattr(os, "environ", env)

    # when
    with pytest.raises(ImportError):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_raises_exception_when_handler_module_has_a_syntax_error(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = dict(os.environ)
    env[Env.HANDLER] = f"{SYNTAX_ERROR_HANDLER}.foo"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SYNTAX_ERROR_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SYNTAX_ERROR_HANDLER}.foo"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "foo"
    reset_sdk.setattr(os, "environ", env)

    # when
    with pytest.raises(SyntaxError):
        from serverless_aws_lambda_sdk.internal_extension import wrapper

        importlib.reload(wrapper)


def test_can_instrument_handler(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)
    response = wrapper.handler({}, context)

    # then
    assert response == "ok", "handler return should not be tampered with"


def test_can_instrument_handler_dev_mode_without_running_server(reset_sdk_dev_mode):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk_dev_mode.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    responses = [wrapper.handler({}, context), wrapper.handler({}, context)]

    # then
    assert responses == ["ok", "ok"], "handler return should not be tampered with"


def test_can_instrument_handler_dev_mode_with_running_server(
    reset_sdk_dev_mode,
    httpserver_listen_address,
    httpserver: HTTPServer,
):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUCCESS_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUCCESS_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk_dev_mode.setattr(os, "environ", env)

    def http_handler(request):
        return Response(str("OK"))

    httpserver.expect_request("/request-response").respond_with_handler(http_handler)
    httpserver.expect_request("/trace").respond_with_handler(http_handler)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    responses = [wrapper.handler({}, context), wrapper.handler({}, context)]

    # then
    assert responses == ["ok", "ok"], "handler return should not be tampered with"


def test_can_instrument_handler_with_submodule(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{SUBMODULE_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{SUBMODULE_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{SUBMODULE_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)
    response = wrapper.handler({}, context)

    # then
    assert response == "ok", "handler return should not be tampered with"


def test_can_instrument_handler_when_handler_fails(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{ERROR_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)

    with pytest.raises(Exception, match=r"Stop"):
        wrapper.handler({}, context)


def test_can_instrument_handler_when_handler_exits_with_error(reset_sdk):
    # given
    from serverless_aws_lambda_sdk.internal_extension.base import Env

    env = os.environ
    env[Env.HANDLER] = f"{UNHANDLED_ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_BASENAME] = f"{UNHANDLED_ERROR_HANDLER}"
    env[Env.HANDLER_BASENAME] = f"{UNHANDLED_ERROR_HANDLER}.handler"
    env[Env.HANDLER_MODULE_DIR] = HANDLER_MODULE_DIR
    env[Env.HANDLER_FUNCTION_NAME] = "handler"
    reset_sdk.setattr(os, "environ", env)

    # when
    from serverless_aws_lambda_sdk.internal_extension import wrapper

    importlib.reload(wrapper)

    # then
    with pytest.raises(SystemExit, match=r"1"):
        wrapper.handler({}, context)
