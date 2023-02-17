from __future__ import annotations

import importlib
import logging
import sys
from importlib import import_module
from importlib.util import module_from_spec, spec_from_file_location
from os import environ
from pathlib import Path
from types import ModuleType
from typing import List, Optional

from typing_extensions import Final

from serverless_aws_lambda_sdk.internal_extension.base import get_module_path
from serverless_aws_lambda_sdk.base import Env, Handler
from serverless_aws_lambda_sdk.exceptions import (
    BuiltInModuleConflict,
    HandlerNotFound,
    ImportModuleError,
    UserCodeSyntaxError,
    handler_not_found,
)
from ..instrument import instrument


__all__: Final[List[str]] = [
    "get_instrumented_handler",
    "handler",
]


LAMBDA_RUNTIME_DIR: Final[Optional[str]] = environ.get(Env.LAMBDA_RUNTIME_DIR)


def import_from_path(path: str) -> Optional[ModuleType]:
    try:
        return import_module(path)

    except Exception as e:
        logging.debug(f"Failed to import {path}: {e}")
        return None


def get_handler_via_module_import(handler: str) -> Handler:
    """Based on logic from AWS Lambda Python runtime"""

    try:
        module_name, function_name = handler.rsplit(".", 1)

    except ValueError as e:
        raise HandlerNotFound(f"Bad handler '{handler}': {e}") from e

    try:
        name, *_ = module_name.split(".")

        if name in sys.builtin_module_names:
            raise BuiltInModuleConflict(
                f"Cannot use built-in module {module_name} as a handler module"
            )

        path = module_name.replace("/", ".")
        module = importlib.import_module(path)

    except ImportError as e:
        raise ImportModuleError(f"Unable to import module '{module_name}': {e}") from e

    except SyntaxError as e:
        raise UserCodeSyntaxError(f"Syntax error in module '{module_name}': {e}") from e

    try:
        return getattr(module, function_name)

    except AttributeError as e:
        raise HandlerNotFound(
            f"Handler '{function_name}' missing on module '{module_name}'"
        ) from e


def get_handler_module(handler: str) -> ModuleType:
    if LAMBDA_RUNTIME_DIR and LAMBDA_RUNTIME_DIR not in sys.path:
        sys.path.append(LAMBDA_RUNTIME_DIR)

    handler_path = Path(handler)
    mod_name, func_name = handler_path.name.split(".")

    names = mod_name, handler_path.name, handler_path.parent.name, handler

    for name in names:
        module = import_from_path(name)

        if module:
            return module

    try:
        module_file = get_module_path(handler)

        if not module_file:
            raise FileNotFoundError(
                f"Couldn't find Lambda function's module: {handler}={module_file}."
            )

        spec = spec_from_file_location(handler, module_file)
        module = module_from_spec(spec)
        spec.loader.exec_module(module)

        return module

    except Exception as e:
        logging.debug(f"Failed to import {handler}: {e}")
        raise handler_not_found(mod_name, "is undefined or not exported") from e


def get_handler_from_module(handler_module: ModuleType, handler: str) -> Handler:
    *_, function_name = handler.split(".")

    try:
        return getattr(handler_module, function_name)

    except Exception as e:
        raise handler_not_found(function_name, "is undefined or not exported") from e


def instrument_safe(user_handler: Handler) -> Handler:
    try:
        return instrument(user_handler)

    except Exception as e:
        logging.error(
            "Fatal Serverless SDK Error: "
            "Please report at https://github.com/serverless/console/issues: "
            f"Async handler setup failed: {e}"
        )

        return user_handler


def get_instrumented_handler_via_name(handler: str) -> Handler:
    user_handler = get_handler_via_module_import(handler)

    return instrument_safe(user_handler)


def get_instrumented_handler_via_path(handler: str) -> Handler:
    handler_module = get_handler_module(handler)
    user_handler = get_handler_from_module(handler_module)

    return instrument_safe(user_handler)


def get_original_handler_and_reset_vars() -> str:
    origin = environ.get(Env.ORIGIN_HANDLER)

    if origin:
        environ[Env.HANDLER] = origin
        del environ[Env.ORIGIN_HANDLER]

    handler = environ.get(Env.HANDLER)
    return handler


def get_instrumented_handler(handler: Optional[str] = None) -> Handler:
    if handler is None:
        handler = get_original_handler_and_reset_vars()

    if not handler:
        raise HandlerNotFound(f"{Env.HANDLER} is not set.")

    try:
        return get_instrumented_handler_via_name(handler)

    except Exception as e:
        logging.debug(f"Couldn't import module from handler name {handler}: {e}")

    try:
        return get_instrumented_handler_via_path(handler)

    except Exception as e:
        logging.error(f"Failed to import handler {handler}: {e}")
        raise handler_not_found(handler, "is undefined or not exported") from e


handler: Final[Handler] = get_instrumented_handler()
