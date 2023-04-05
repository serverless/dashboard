#!/usr/bin/env python3
import sys
import os
import time
from pathlib import Path
import importlib.util

_SLS_ORG_ID = os.environ.get("SLS_ORG_ID")
_IS_DEBUG_MODE = bool(os.environ.get("SLS_SDK_DEBUG"))
_LAMBDA_TASK_ROOT = os.environ.get("LAMBDA_TASK_ROOT")
_DEFAULT_TASK_ROOT = "/var/task"


def _debug_log(msg):
    if _IS_DEBUG_MODE:
        print(f"⚡ SDK: {msg}", file=sys.stderr)


# checks if module exists, without loading it
def _module_exists(module_dir, module_name):
    path_modified = False
    if module_dir not in sys.path:
        path_modified = True
        sys.path.append(module_dir)
    try:
        return importlib.util.find_spec(module_name) is not None
    finally:
        if path_modified:
            sys.path.remove(module_dir)


def _set_handler():
    process_start_time_ns = time.time_ns()
    process_start_time_relative = time.perf_counter_ns()
    os.environ["_SLS_PROCESS_START_TIME"] = str(process_start_time_ns)
    if not _SLS_ORG_ID:
        print(
            "Serverless SDK Warning: "
            "Cannot instrument function: "
            'Missing "SLS_ORG_ID" environment variable',
            file=sys.stderr,
        )
        return

    _debug_log("Wrapper initialization")

    handler = os.environ.get("_HANDLER")
    handler = handler.replace("/", ".")

    task_root = Path(_LAMBDA_TASK_ROOT).resolve()
    if not task_root.exists():
        task_root = Path(_DEFAULT_TASK_ROOT).resolve()

    handler_path = Path(handler)
    handler_dir = (
        handler_path.parent
    )  # relative path of directory containing the handler, can be "."
    handler_module_dir = str(
        (task_root / handler_dir.name).resolve()
    )  # absolute path of the directory containing the module

    handler_basename = handler_path.name  # name of the handler, such as "index.handler"
    try:
        (handler_module_basename, _) = handler_basename.rsplit(".", 1)
    except ValueError:
        return
    if handler_module_basename.split(".")[0] in sys.builtin_module_names:
        return

    if not _module_exists(handler_module_dir, handler_module_basename):
        return

    os.environ["_ORIGIN_HANDLER"] = os.environ["_HANDLER"]
    os.environ[
        "_HANDLER"
    ] = "serverless_aws_lambda_sdk.internal_extension.wrapper.handler"

    ms = round((time.perf_counter_ns() - process_start_time_relative) / 1_000_000)
    _debug_log(f"Overhead duration: Internal initialization: {ms}ms")


# This script is executed by AWS Lambda Runtime as follows:
# /opt/sls-sdk-python/exec_wrapper.py /var/lang/bin/python3 /var/runtime/bootstrap.py
def main():
    try:
        _set_handler()
    except:
        import traceback

        print(
            "Fatal Serverless SDK Error: "
            "Please report at https://github.com/serverless/console/issues: "
            "Internal extension setup failed.",
            traceback.format_exc(),
            file=sys.stderr,
        )

    _, *args = sys.argv
    command = " ".join(args)
    os.system(command)


if __name__ == "__main__":
    main()
