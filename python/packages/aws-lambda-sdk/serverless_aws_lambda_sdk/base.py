from __future__ import annotations

from typing import Callable, Tuple, TypeVar

from strenum import StrEnum
from typing_extensions import Concatenate, Final, ParamSpec, Self


NEW_HANDLER: Final[
    str
] = "/opt/serverless_aws_lambda_sdk/internal_extension/wrapper.handler"
PYTHON_EXTS: Final[Tuple[str, ...]] = (".py", ".pyc", ".pyo", ".pyd")


P = ParamSpec("P")
I_P = ParamSpec("I_P")
T = TypeVar("T")

HandlerPath = str
Handler = Callable[P, T]
InstrumentParams = Concatenate[HandlerPath, I_P]
Instrument = Callable[InstrumentParams, Handler]
Loader = Callable[[HandlerPath], Handler]


class Env(StrEnum):
    HANDLER: Self = "_HANDLER"
    ORIGIN_HANDLER: Self = "_ORIGIN_HANDLER"
    LAMBDA_RUNTIME_DIR: Self = "LAMBDA_RUNTIME_DIR"
    LAMBDA_TASK_ROOT: Self = "LAMBDA_TASK_ROOT"

    SLS_ORG_ID: Self = "SLS_ORG_ID"
    SLS_SDK_DEBUG: Self = "SLS_SDK_DEBUG"