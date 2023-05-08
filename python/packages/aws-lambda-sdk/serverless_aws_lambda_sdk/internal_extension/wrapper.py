from __future__ import annotations
import importlib
from os import environ
from typing import List

from typing_extensions import Final

__all__: Final[List[str]] = [
    "handler",
]

if environ.get("_ORIGIN_HANDLER") is None:
    raise Exception("Missing _ORIGIN_HANDLER environment variable")

environ["_HANDLER"] = environ.get("_ORIGIN_HANDLER")
del environ["_ORIGIN_HANDLER"]

_IMPORT_FAILED = False
try:
    try:
        from serverless_aws_lambda_sdk import serverlessSdk
    except ModuleNotFoundError:
        from .. import serverlessSdk

    try:
        serverlessSdk._initialize()
    except Exception as ex:
        serverlessSdk._report_error(ex)

    from ..instrument import Instrumenter  # noqa E402
except:
    import traceback
    import sys

    print(
        "Fatal Serverless SDK Error: "
        "Please report at https://github.com/serverless/console/issues: "
        "Internal extension wrapper failed.",
        traceback.format_exc(),
        file=sys.stderr,
    )
    _IMPORT_FAILED = True


class HandlerNotFound(Exception):
    pass


class HandlerTypeError(Exception):
    pass


# To make sure errors appear the same way as uninstrumented
HandlerNotFound.__name__ = "Runtime.HandlerNotFound"
HandlerTypeError.__name__ = "TypeError"


def _get_instrumented_handler():
    handler = environ.get("_HANDLER")
    (module_name, function_name) = handler.rsplit(".", 1)
    module = importlib.import_module(module_name.replace("/", "."))

    # this is to make sure we report these errors from the invocation phase,
    # instead of the init phase.
    def handler_generator():
        try:
            _handler = getattr(module, function_name)
        except AttributeError:
            raise HandlerNotFound(
                f"Handler '{function_name}' missing on module '{module_name}'"
            )
        if not callable(_handler):
            raise HandlerTypeError(
                f"'{type(_handler).__name__}' object is not callable"
            )
        return _handler

    if not _IMPORT_FAILED:
        try:
            instrumenter = Instrumenter()
            return instrumenter.instrument(handler_generator)
        except Exception as ex:
            serverlessSdk._report_error(ex)
            return handler_generator()
    else:
        return handler_generator()


handler = _get_instrumented_handler()
