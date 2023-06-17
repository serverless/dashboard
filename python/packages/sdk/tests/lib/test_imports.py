from __future__ import annotations

from sls_sdk.lib.imports import internally_imported
import pytest
from pathlib import Path
import sys
import os


def test_internally_imported():
    # given
    path = str(Path(__file__).parent / "flask.py")
    f = open(path, "w", encoding="utf-8")
    f.write("VALUE = 1")
    f.close()

    value = 0

    if "flask" in sys.modules:
        del sys.modules["flask"]

    # when
    with internally_imported(internal_path=str(Path(__file__).resolve().parent)):
        import flask

        os.remove(path)

        value = flask.VALUE
        with pytest.raises(Exception):
            print(flask.Config)

    import flask

    # then
    assert flask.Config is not None
    assert value == 1

    del sys.modules["flask"]
