import sys
from pathlib import Path
import os


def test_exec_wrapper_succeeds(monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    os.environ["_TEST_INTERNAL_EXTENSION"] = "0"

    monkeypatch.setenv("_HANDLER", "fixtures.lambdas.success.handler")
    monkeypatch.setenv("LAMBDA_TASK_ROOT", str(Path(__file__).parent.resolve()))
    monkeypatch.setenv("SLS_ORG_ID", "test-org")
    monkeypatch.setenv("SLS_SDK_DEBUG", "1")
    monkeypatch.setenv("LAMBDA_RUNTIME_DIR", "/var/runtime")
    monkeypatch.setattr(
        "sys.argv",
        [
            "/opt/sls-sdk-python/exec_wrapper.py",
            "/var/lang/bin/python3",
            str(Path(__file__).resolve()),
        ],
    )
    sys.path.append(
        str(
            (
                Path(__file__).parent.parent.parent
                / "serverless_aws_lambda_sdk/internal_extension"
            ).resolve()
        )
    )
    sys.path.append(str((Path(__file__).parent).resolve()))

    # when
    from serverless_aws_lambda_sdk.internal_extension.exec_wrapper import (
        main as exec_wrapper_main,
    )

    exec_wrapper_main()

    # then
    assert os.environ["_TEST_INTERNAL_EXTENSION"] == "1"
    del os.environ["_TEST_INTERNAL_EXTENSION"]


def main():
    os.environ["_TEST_INTERNAL_EXTENSION"] = "1"
