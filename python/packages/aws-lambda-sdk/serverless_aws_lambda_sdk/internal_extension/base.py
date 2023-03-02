from __future__ import annotations

import logging
from os import environ
from pathlib import Path
from typing import Optional, Tuple
from importlib import import_module
import sys
from timeit import default_timer

from strenum import StrEnum

from typing_extensions import Final, Self


NS_IN_MS: Final[int] = 1_000_000
NEW_HANDLER: Final[str] = "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"
PYTHON_EXTS: Final[Tuple[str, ...]] = (".py", ".pyc", ".pyo", ".pyd")


class Env(StrEnum):
    HANDLER: Self = "_HANDLER"
    ORIGIN_HANDLER: Self = "_ORIGIN_HANDLER"
    LAMBDA_TASK_ROOT: Self = "LAMBDA_TASK_ROOT"

    SLS_ORG_ID: Self = "SLS_ORG_ID"
    SLS_SDK_DEBUG: Self = "SLS_SDK_DEBUG"

    PROCESS_START_TIME: Self = "_SLS_PROCESS_START_TIME"
    HANDLER_MODULE_BASENAME: Self = "_SLS_HANDLER_MODULE_BASENAME"
    HANDLER_BASENAME: Self = "_SLS_HANDLER_BASENAME"
    HANDLER_MODULE_DIR: Self = "_SLS_HANDLER_MODULE_DIR"
    HANDLER_FUNCTION_NAME: Self = "_SLS_HANDLER_FUNCTION_NAME"


# Lambda env vars, for details see
# https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html
# Set by AWS Lambda Runtime, represents user's handler
# such as "lambda_function.lambda_handler"
HANDLER: Final[Optional[str]] = environ.get(Env.HANDLER)

# The directory that contains the function code.
LAMBDA_TASK_ROOT: Final[Optional[str]] = environ.get(Env.LAMBDA_TASK_ROOT)

# Serverless env vars
SLS_ORG_ID: Final[Optional[str]] = environ.get(Env.SLS_ORG_ID)
SLS_SDK_DEBUG: Final[Optional[str]] = environ.get(Env.SLS_SDK_DEBUG)

DEFAULT_TASK_ROOT: Final[str] = "/var/task"


def _configure_logger(debug):
    # Configures module level logger.

    logger = logging.getLogger(__name__)
    handler = logging.StreamHandler()
    formatter = logging.Formatter("⚡ SDK: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    if debug:
        logger.setLevel(logging.DEBUG)
    return logger


_logger = _configure_logger(SLS_SDK_DEBUG)


def timer():
    return int(default_timer() * 1000000000)


def initialize(handler: Optional[str] = HANDLER):
    """Checks handler is an importable function, inits env variables for the handler.

    If handler is not importable, or it is not a callable function,
    returns immediately. In that case, env variables are not modified and
    AWS Lambda Runtime will handle the errors and surface them to the client.

    Args:
        handler (Optional[str], optional): _description_. Defaults to HANDLER.
    """
    try:
        process_start_time = timer()
        environ[Env.PROCESS_START_TIME] = str(process_start_time)

        # AWS Lambda Python runtime converts forward slashes to dots.
        handler = handler.replace("/", ".")

        if not SLS_ORG_ID:
            _logger.error(
                "Serverless SDK Warning: "
                "Cannot instrument function: "
                'Missing "SLS_ORG_ID" environment variable',
            )
            return

        _logger.debug("Wrapper initialization")

        task_root = Path(LAMBDA_TASK_ROOT).resolve()
        if not task_root.exists():
            task_root = Path(DEFAULT_TASK_ROOT).resolve()

        handler_path = Path(handler)
        handler_dir = (
            handler_path.parent
        )  # relative path of directory containing the handler, can be "."
        handler_basename = (
            handler_path.name
        )  # name of the handler, such as "index.handler"
        try:
            handler_module_basename, handler_function_name = handler_basename.rsplit(
                ".", 1
            )
        except ValueError:
            return

        if handler_module_basename.split(".")[0] in sys.builtin_module_names:
            return

        handler_module_dir = str(
            (task_root / handler_dir.name).resolve()
        )  # absolute path of the directory containing the module

        # Add the SDK installation folder to sys.path
        sys.path.append("/opt/python/lib/python3.9/site-packages")

        # Try to import the client's handler module and check the handler
        # function if it is a callable. To do that, add the client's handler
        # module path to sys.path so that it can be searched by Python when importing.
        path_modified = False
        if handler_module_dir not in sys.path:
            path_modified = True
            sys.path.append(handler_module_dir)
        try:
            module = import_module(handler_module_basename)
            handler_function = getattr(module, handler_function_name)
            if not handler_function or not callable(handler_function):
                return
        except Exception:
            return
        finally:
            if path_modified:
                sys.path.remove(handler_module_dir)

        environ[Env.HANDLER_MODULE_BASENAME] = handler_module_basename
        environ[Env.HANDLER_BASENAME] = handler_basename
        environ[Env.HANDLER_FUNCTION_NAME] = handler_function_name
        environ[Env.HANDLER_MODULE_DIR] = handler_module_dir

        environ[Env.ORIGIN_HANDLER] = HANDLER
        environ[Env.HANDLER] = NEW_HANDLER

        end = timer()
        ms = round((end - process_start_time) / NS_IN_MS)

        _logger.debug(f"Overhead duration: Internal initialization: {ms}ms")
    except Exception:
        _logger.exception(
            "Fatal Serverless SDK Error: "
            "Please report at https://github.com/serverless/console/issues: "
            "Internal extension setup failed."
        )
