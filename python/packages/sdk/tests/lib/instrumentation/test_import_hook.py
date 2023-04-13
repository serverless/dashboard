from unittest.mock import MagicMock
import sys
import importlib
from sls_sdk.lib.instrumentation.import_hook import ImportHook


def test_target_module_already_imported():
    # given
    import os

    hook = ImportHook("os")
    mock = MagicMock()

    def _hook(module):
        setattr(module, "foo", "bar")
        mock()

    # when
    hook.enable(_hook)

    # then
    mock.assert_called_once()
    assert os.foo == "bar"
    assert hook.enabled

    # when
    hook.disable(lambda module: delattr(module, "foo"))

    # then
    assert not hasattr(os, "foo")
    assert not hook.enabled


def test_target_module_not_imported_yet():
    # given
    sys.modules.pop("os", None)

    hook = ImportHook("os")
    mock = MagicMock()

    def _hook(module):
        setattr(module, "foo", "bar")
        mock()

    # os is not imported yet, enable the hook
    hook.enable(_hook)
    assert hook.enabled

    # the hook is not called yet, because os is not imported yet
    mock.assert_not_called()

    import os

    # os is imported, the hook had been called at this point
    mock.assert_called_once()

    assert os.foo == "bar"

    # disable the hook
    hook.disable(lambda module: delattr(module, "foo"))
    assert not hook.enabled

    # it should immediately execute the undo hook
    assert not hasattr(os, "foo")

    # reload to make sure the hook was disabled properly
    importlib.reload(os)

    # then
    assert not hasattr(os, "foo")
