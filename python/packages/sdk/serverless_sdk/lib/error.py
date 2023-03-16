import os
from builtins import type as builtins_type
from .stack_trace_string import resolve as resolve_stack_trace_string

from .error_captured_event import create as create_error_captured_event
import logging


logger = logging.getLogger(__name__)


def report(error, type: str = "INTERNAL"):
    if os.environ.get("SLS_CRASH_ON_SDK_ERROR", None):
        if isinstance(error, BaseException):
            raise error
        else:
            raise Exception(error)

    error_data = {
        "source": "serverlessSdk",
        "type": f"ERROR_TYPE_CAUGHT_SDK_{type}",
        "name": builtins_type(error).__name__,
        "message": str(error),
        "stack": resolve_stack_trace_string(error),
    }

    if type == "INTERNAL":
        error_data["description"] = (
            "Internal Serverless SDK Error. "
            + "Please report at https://github.com/serverless/console/issue"
        )

    if hasattr(error, "code"):
        error_data["code"] = error.code

    logger.error(error_data)

    try:
        create_error_captured_event(
            error_data["message"],
            name=error_data["name"],
            stack=error_data["stack"],
            type="handledSdkUser" if type == "USER" else "handledSdkInternal",
            origin="pythonConsole",
        )
    except:
        # ignore
        pass
