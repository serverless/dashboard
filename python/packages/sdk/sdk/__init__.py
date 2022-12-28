from typing_extensions import Final
from typing import List, Optional, Collection
from dataclasses import dataclass
from os import environ

from pkg_resources import get_distribution


# only export `serverlessSdk`
__all__: Final[List[str]] = [
  'serverlessSdk',
]

__version__: Final[str] = ...
__name__: Final[str] = ...


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
    self.orgId = environ[SLS_ORG_ID] or options.orgId


serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
