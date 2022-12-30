from typing import Final, List
from secrets import token_hex

from .base import TraceId


__all__: Final[List[str]] = [
    "generate_id",
]


DEFAULT_BYTES: Final[int] = 16


def generate_id(count: int = DEFAULT_BYTES) -> TraceId:
    return token_hex(count)
