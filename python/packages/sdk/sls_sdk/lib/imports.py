from __future__ import annotations
from contextlib import contextmanager
import sys
import os
from typing import Dict
from types import ModuleType

_INTERNAL_MODULES: Dict[str, ModuleType] = dict()

_LOCK = None

if bool(os.environ.get("SLS_DEV_MODE_ORG_ID")):
    import threading

    _LOCK = threading.Lock()


@contextmanager
def internally_imported(
    *top_level_module_names: str, internal_path: str = "/opt/python"
):
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

        yield

        sys.path = original_sys_path  # Rollback the path change

        # Remove the internal modules from sys.modules
        # to prevent them being imported by customer code
        for module_name in sys.modules.copy():
            if module_name not in previously_cached_modules and [
                prefix
                for prefix in top_level_module_names
                if module_name == prefix or module_name.startswith(f"{prefix}.")
            ]:
                _INTERNAL_MODULES[module_name] = sys.modules[module_name]
                del sys.modules[module_name]

    if _LOCK:
        with _LOCK:
            return _import()
    else:
        return _import()
