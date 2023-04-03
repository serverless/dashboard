import pytest
import os
from unittest.mock import patch


def test_exec_wrapper_succeeds(reset_sdk, monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    lambda_handler = "success.handler"
    monkeypatch.setenv("_ORIGIN_HANDLER", lambda_handler)

    # when
    import serverless_aws_lambda_sdk.internal_extension.wrapper as wrapper

    response = wrapper.handler({}, {})

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert os.environ.get("_ORIGIN_HANDLER") is None
    assert response == "ok"


def test_exec_wrapper_nonexistent_handler(reset_sdk, monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    lambda_handler = "success.nonexistent_handler"
    monkeypatch.setenv("_ORIGIN_HANDLER", lambda_handler)

    # when
    import serverless_aws_lambda_sdk.internal_extension.wrapper as wrapper

    with pytest.raises(wrapper.HandlerNotFound):
        wrapper.handler({}, {})

    # then
    assert callable(wrapper.handler)
    assert os.environ["_HANDLER"] == lambda_handler
    assert os.environ.get("_ORIGIN_HANDLER") is None


def test_exec_wrapper_noncallable_handler(reset_sdk, monkeypatch):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    lambda_handler = "not_callable.handler"
    monkeypatch.setenv("_ORIGIN_HANDLER", lambda_handler)

    # when
    import serverless_aws_lambda_sdk.internal_extension.wrapper as wrapper

    with pytest.raises(wrapper.HandlerTypeError):
        wrapper.handler({}, {})

    # then
    assert callable(wrapper.handler)
    assert os.environ["_HANDLER"] == lambda_handler
    assert os.environ.get("_ORIGIN_HANDLER") is None


def test_exec_wrapper_returns_uninstrumented_handler_if_initialization_error(
    reset_sdk, monkeypatch
):
    # given
    env = dict(os.environ)
    monkeypatch.setattr(os, "environ", env)

    lambda_handler = "success.handler"
    monkeypatch.setenv("_ORIGIN_HANDLER", lambda_handler)

    # when
    import serverless_aws_lambda_sdk.instrument

    with patch(
        "serverless_aws_lambda_sdk.instrument.Instrumenter"
    ) as mocked_instrumenter:
        mocked_instrumenter.side_effect = Exception("error")
        import serverless_aws_lambda_sdk.internal_extension.wrapper as wrapper

        response = wrapper.handler({}, {})

    # then
    assert os.environ["_HANDLER"] == lambda_handler
    assert os.environ.get("_ORIGIN_HANDLER") is None
    assert response == "ok"
