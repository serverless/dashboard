from __future__ import annotations

from serverless_sdk import serverlessSdk

from .base import NAME, __version__


__all__ = [
    "serverlessSdk",
]


serverlessSdk.name = NAME
serverlessSdk.version = __version__
