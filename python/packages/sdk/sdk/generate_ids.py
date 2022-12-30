from typing import Final, List
from secrets import token_hex

from .base import TraceId


__all__: Final[List[str]] = [
    "generate_id",
]


def generate_id(count: int) -> TraceId:
    return token_hex(count)
