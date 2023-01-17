from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Union

from importlib_metadata import packages_distributions, version
from typing_extensions import Final


FIRST: Final[int] = 0
SLS_ORG_ID: Final[str] = "SLS_ORG_ID"

_packages: Final[Dict[str, List[str]]] = packages_distributions()
_pkg_name: str = __name__ or __package__
_pkg_name, *_ = _pkg_name.split(".")
_distribution: Final[List[str]] = _packages[_pkg_name]

# module metadata
__name__: Final[str] = _distribution[FIRST]
__version__: Final[str] = version(__name__)


TraceId = str
Nanoseconds = int
DateStr = str

TagType = Union[str, int, float, DateStr, bool, datetime]
TagList = List[TagType]
ValidTags = Union[TagType, TagList]
