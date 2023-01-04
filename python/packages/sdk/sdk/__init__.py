from __future__ import annotations
from typing_extensions import Final
from typing import Dict, List, Optional
from os import environ

from importlib_metadata import version, packages_distributions


# public exports
__all__: Final[List[str]] = [
    "serverlessSdk",
]

FIRST: Final[int] = 0

_packages: Final[Dict[str, List[str]]] = packages_distributions()
_pkg_name: Final[str] = __name__ or __package__
_distribution: Final[List[str]] = _packages[_pkg_name]

__name__: Final[str] = _distribution[FIRST]
__version__: Final[str] = version(__name__)


SLS_ORG_ID: Final[str] = "SLS_ORG_ID"


class ServerlessSdk:
    name: Final[str] = __name__
    version: Final[str] = __version__

    traceSpans: Final = ...
    instrumentation: Final = ...

    orgId: Optional[str] = None

    def _initialize(self, org_id: Optional[str] = None):
        self.orgId = environ.get(SLS_ORG_ID, default=org_id)


serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
