from __future__ import annotations
from contextlib import contextmanager
import sys
import os

_INTERNAL_MODULES = dict()  # type: ignore

_LOCK = None

if bool(os.environ.get("SLS_DEV_MODE_ORG_ID")):
    import threading

    _LOCK = threading.Lock()


@contextmanager
def internally_imported(internal_path: str = "/opt/python"):
    def _import():
        previously_cached_modules = sys.modules.copy()
        original_sys_path = sys.path.copy()
        sys.path.insert(
            0, internal_path
        )  # Ensure all imports are from the lambda layer
        sys.path = list(
            filter(lambda p: p != "/var/task", sys.path)
        )  # Ensure no imports are from the lambda function (e.g. the user's code)

        sys.modules.update(
            _INTERNAL_MODULES
        )  # Restore previous internal imports to sys.modules to make them visible

        # At this point we yield control, so that our layer's modules can be imported
        yield

        # At this point, modules were imported, so we need to undo the changes we made
        sys.path = original_sys_path  # Rollback the path change

        # Remove the internal modules from sys.modules
        # to prevent them being imported by customer code
        for module_name in sys.modules.copy():
            if module_name not in previously_cached_modules:
                _INTERNAL_MODULES[module_name] = sys.modules[module_name]
                del sys.modules[module_name]

    if _LOCK:
        with _LOCK:
            return _import()
    else:
        return _import()
