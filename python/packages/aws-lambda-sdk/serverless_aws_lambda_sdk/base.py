from __future__ import annotations
from typing import Callable, TypeVar
from typing_extensions import Concatenate, Final, ParamSpec
import sys

if sys.version_info[1] < 8:
    from importlib_metadata import version
else:
    from importlib.metadata import version

# module metadata
__name__: Final[str] = "serverless-aws-lambda-sdk"
__version__: Final[str] = version(__name__)

NAME: Final[str] = __name__


P = ParamSpec("P")
I_P = ParamSpec("I_P")
T = TypeVar("T")

HandlerPath = str
Handler = Callable[P, T]
InstrumentParams = Concatenate[HandlerPath, I_P]
Instrument = Callable[InstrumentParams, Handler]
Loader = Callable[[HandlerPath], Handler]
