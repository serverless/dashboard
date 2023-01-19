from __future__ import annotations

import importlib
import logging
import sys
from functools import lru_cache
from os import environ
from pathlib import Path
from time import time_ns
from typing import Optional

from typing_extensions import Final

from ..base import Env, Handler, NEW_HANDLER, PYTHON_EXTS
from ..exceptions import (
    BuiltInModuleConflict,
    HandlerNotFound,
    ImportModuleError,
    UserCodeSyntaxError,
)


NS_IN_MS: Final[int] = 1_000_000

# Lambda env vars
HANDLER: Final[Optional[str]] = environ.get(Env.HANDLER)
LAMBDA_TASK_ROOT: Final[Optional[str]] = environ.get(Env.LAMBDA_TASK_ROOT)

# Serverless env vars
SLS_ORG_ID: Final[Optional[str]] = environ.get(Env.SLS_ORG_ID)
SLS_SDK_DEBUG: Final[Optional[str]] = environ.get(Env.SLS_SDK_DEBUG)

DEFAULT_TASK_ROOT: Final[str] = "/var/task"


cache = lru_cache(maxsize=1)


def initialize(handler: Optional[str] = HANDLER):
    start = time_ns()

    if SLS_SDK_DEBUG:
        logging.basicConfig(level=logging.DEBUG, format="⚡ SDK: %(message)s")

    logging.debug("Wrapper initialization")

    if not handler or "." not in handler or ".." in handler:
        # Bad handler, let error naturally surface
        return

    if not SLS_ORG_ID:
        logging.error(
            "Serverless SDK Warning: "
            "Cannot instrument function: "
            'Missing "SLS_ORG_ID" environment variable',
        )
        return

    get_module_path(handler)
    set_handler_vars()

    end = time_ns()
    ms = round((end - start) / NS_IN_MS)

    logging.debug(f"Overhead duration: Internal initialization: {ms}ms")


@cache
def get_module_path(handler: str = HANDLER) -> Optional[Path]:
    handler = Path(handler).resolve()
    handler_dir = handler.parent
    handler_basename = handler.name
    handler_module_name, *_ = handler_basename.split(".")

    task_root = Path(LAMBDA_TASK_ROOT)

    if not task_root.exists():
        task_root = Path(DEFAULT_TASK_ROOT)

    handler_module_dir = (task_root / handler_dir.name).resolve()
    handler_module = (handler_module_dir / handler_module_name).resolve()

    for ext in PYTHON_EXTS:
        module_file = handler_module.with_suffix(ext)

        if module_file.exists():
            return module_file

    if handler_module.exists():
        return handler_module

    return None


def get_handler_via_module_import(handler: str = HANDLER) -> Handler:
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


def set_handler_vars():
    environ[Env.ORIGIN_HANDLER] = HANDLER
    environ[Env.HANDLER] = NEW_HANDLER
