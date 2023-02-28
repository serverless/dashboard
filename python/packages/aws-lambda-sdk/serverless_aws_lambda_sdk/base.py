from __future__ import annotations

from typing import Callable, Dict, List, TypeVar

from importlib_metadata import packages_distributions, version
from typing_extensions import Concatenate, Final, ParamSpec


FIRST: Final[int] = 0

_packages: Final[Dict[str, List[str]]] = packages_distributions()
_pkg_name: str = __name__ or __package__
_pkg_name, *_ = _pkg_name.split(".")
_distribution: Final[List[str]] = _packages[_pkg_name]

# module metadata
__name__: Final[str] = _distribution[FIRST]
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
