from __future__ import annotations

from typing_extensions import Final
from typing import List

from .sdk import ServerlessSdk
from .trace_span import TraceSpan


# public exports
__all__: Final[List[str]] = [
    "serverlessSdk",
]

serverlessSdk: Final[ServerlessSdk] = ServerlessSdk()
