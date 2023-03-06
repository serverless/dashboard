from __future__ import annotations

import importlib
import logging
import sys
from os import environ
from typing import List, Optional

from typing_extensions import Final, TypeAlias, TYPE_CHECKING

from ..base import Handler
from .base import Env
from ..exceptions import HandlerNotFound

from ..instrument import Instrumenter

if TYPE_CHECKING:
    from serverless_sdk.sdk.base import ServerlessSdk

else:
    ServerlessSdk: TypeAlias = "ServerlessSdk"


__all__: Final[List[str]] = [
    "handler",
]


HANDLER_MODULE_BASENAME: Final[Optional[str]] = environ.get(Env.HANDLER_MODULE_BASENAME)
HANDLER_BASENAME: Final[Optional[str]] = environ.get(Env.HANDLER_BASENAME)
HANDLER_MODULE_DIR: Final[Optional[str]] = environ.get(Env.HANDLER_MODULE_DIR)
HANDLER_FUNCTION_NAME: Final[Optional[str]] = environ.get(Env.HANDLER_FUNCTION_NAME)


def _get_handler_function():
    path_modified = False
    if HANDLER_MODULE_DIR not in sys.path:
        path_modified = True
        sys.path.append(HANDLER_MODULE_DIR)
    try:
        module = importlib.import_module(HANDLER_MODULE_BASENAME)
        return getattr(module, HANDLER_FUNCTION_NAME)
    finally:
        if path_modified:
            sys.path.remove(HANDLER_MODULE_DIR)


# 1. Initialize SDK instrumentation
def _get_sdk() -> ServerlessSdk:
    try:
        from serverless_aws_lambda_sdk import serverlessSdk

        sdk = serverlessSdk

    except ImportError:
        from .. import serverlessSdk

        sdk = serverlessSdk

    try:
        sdk._initialize()
    except Exception as ex:
        # TODO: call _reportError on sdk
        logging.error(ex)

    return sdk


def _check_original_handler_and_reset_vars() -> str:
    origin = environ.get(Env.ORIGIN_HANDLER)

    if origin:
        environ[Env.HANDLER] = origin
        del environ[Env.ORIGIN_HANDLER]

    handler = environ.get(Env.HANDLER)

    if not handler:
        raise HandlerNotFound(f"{Env.HANDLER} is not set.")


def _get_instrumented_handler() -> Handler:
    _check_original_handler_and_reset_vars()

    handler = _get_handler_function()
    _get_sdk()

    try:
        instrumenter = Instrumenter()
        return instrumenter.instrument(handler)
    except Exception as ex:
        # TODO: call _reportError on sdk
        logging.error(ex)
        return handler


handler: Final[Handler] = _get_instrumented_handler()
