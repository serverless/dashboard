from typing_extensions import Final
from typing import List, Optional
from dataclasses import dataclass
from os import environ

from pkg_resources import get_distribution


# public exports
__all__: Final[List[str]] = [
  'serverlessSdk',
  'Options',
]

_distribution = get_distribution(__package__ or __name__)

__version__: Final[str] = _distribution.version
__name__: Final[str] = _distribution.project_name


SLS_ORG_ID: Final[str] = 'SLS_ORG_ID'


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
