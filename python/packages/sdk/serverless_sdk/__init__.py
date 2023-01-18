from __future__ import annotations

from typing_extensions import Final
from typing import List

from .sdk.base import ServerlessSdk


# public exports
__all__: Final[List[str]] = [
    "serverlessSdk",
]

serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
