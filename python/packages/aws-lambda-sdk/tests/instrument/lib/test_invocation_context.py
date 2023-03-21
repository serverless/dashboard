import importlib
from unittest.mock import MagicMock


def test_invocation_context():
    # given
    import serverless_aws_lambda_sdk.instrument.lib.invocation_context as ic

    importlib.reload(ic)
    context = MagicMock()

    # when
    initial = ic.get()
    ic.set(context)

    # then
    assert initial is None
    assert ic.get() == context
