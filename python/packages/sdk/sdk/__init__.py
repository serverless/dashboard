from typing_extensions import Final
from typing import List, Optional
from dataclasses import dataclass
from os import environ

from pkg_resources import get_distribution


# public exports
__all__: Final[List[str]] = [
  'serverlessSdk',
]

__version__: Final[str] = ...
__name__: Final[str] = ...


SLS_ORG_ID: Final[str] = 'SLS_ORG_ID'


@dataclass
class Options:
  orgId: Optional[str] = None


class _ServerlessSdk:
  name: Final[str] = __name__
  version: Final[str] = __version__

  traceSpans: Final = ...
  instrumentation: Final = ...

  orgId: Optional[str] = None

  def _initialize(self, options: Options = Options()):
    self.orgId = environ[SLS_ORG_ID] or options.orgId


serverlessSdk: Final[_ServerlessSdk] = _ServerlessSdk()
