from __future__ import annotations

import inspect
import sys
from pathlib import Path
from typing import Callable, Dict

from serverless_aws_lambda_sdk.base import Handler


sys.path.append(str(Path(__file__).parent / "fixtures/lambdas"))

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
