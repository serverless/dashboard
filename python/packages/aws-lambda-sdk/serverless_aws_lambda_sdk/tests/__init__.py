from __future__ import annotations

import inspect
from os import environ
from typing import Callable, Dict

from ..base import Handler


environ["AWS_LAMBDA_FUNCTION_NAME"] = "example.handler"
environ["SLS_ORG_ID"] = "hello.world"
environ["AWS_LAMBDA_INITIALIZATION_TYPE"] = "on-demand"
environ["AWS_LAMBDA_FUNCTION_VERSION"] = "1"


Params = Dict[str, inspect.Parameter]


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters


def compare_handlers(original: Handler, instrumented: Handler):
    assert callable(original) and callable(instrumented)

    orig_params = get_params(original)
    instrumented_params = get_params(instrumented)
    assert orig_params == instrumented_params

    orig_result = original(1, 2)
    instrumented_result = instrumented(1, 2)
    assert orig_result == instrumented_result
