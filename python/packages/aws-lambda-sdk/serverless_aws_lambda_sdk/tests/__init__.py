from __future__ import annotations

import inspect
from os import environ
from functools import wraps
from typing import Callable, Dict

from ..base import Handler


environ["AWS_LAMBDA_FUNCTION_NAME"] = "example.handler"
environ["SLS_ORG_ID"] = "hello.world"
environ["AWS_LAMBDA_INITIALIZATION_TYPE"] = "on-demand"
environ["AWS_LAMBDA_FUNCTION_VERSION"] = "1"


Params = Dict[str, inspect.Parameter]


class Context:
    aws_request_id: int = 1234


ctx = Context()


def reset_globals():
    from ..trace_spans.aws_lambda import (
        aws_lambda_span,
        aws_lambda_initialization,
        aws_lambda_invocation,
        get_tags,
    )

    for span in aws_lambda_span, aws_lambda_initialization, aws_lambda_invocation:
        tags = get_tags()
        span.end_time = None
        span.tags = tags


def ensure_globals(func: Callable) -> Callable:
    @wraps(func)
    def wrapper(*args, **kwargs):
        reset_globals()
        val = func(*args, **kwargs)
        reset_globals()

        return val

    return wrapper


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters


@ensure_globals
def compare_handlers(original: Handler, instrumented: Handler):
    assert callable(original) and callable(instrumented)

    orig_params = get_params(original)
    instrumented_params = get_params(instrumented)
    assert orig_params == instrumented_params

    orig_result = original(None, ctx)
    instrumented_result = instrumented(None, ctx)
    assert orig_result == instrumented_result
