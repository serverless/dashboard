from __future__ import annotations

from typing_extensions import Final
from typing import Dict, List, Optional
from dataclasses import dataclass
from os import environ

from importlib_metadata import version, packages_distributions  # available in Python >=3.8


# public exports
__all__: Final[List[str]] = [
    "serverlessSdk",
    "Options",
]

FIRST: Final[int] = 0

_packages: Final[Dict[str, List[str]]] = packages_distributions()
_pkg_name: Final[str] = __name__ or __package__
_distribution: Final[List[str]] = _packages[_pkg_name]

__name__: Final[str] = _distribution[FIRST]
__version__: Final[str] = version(__name__)

SLS_ORG_ID: Final[str] = "SLS_ORG_ID"


@dataclass
class Options:
    orgId: Optional[str] = None


class ServerlessSdk:
    name: Final[str] = __name__
    version: Final[str] = __version__

    traceSpans: Final = ...
    instrumentation: Final = ...

    orgId: Optional[str] = None

    def _initialize(self, options: Options = Options()):
        self.orgId = environ.get(SLS_ORG_ID, default=options.orgId)


serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
