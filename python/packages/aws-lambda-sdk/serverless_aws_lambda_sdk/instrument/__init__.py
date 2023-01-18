from __future__ import annotations

from functools import wraps
from typing import List

from typing_extensions import Final

from ..base import Handler


__all__: Final[List[str]] = [
    "instrument",
]


def instrument(user_handler: Handler, *args, **kwargs) -> Handler:
    @wraps(user_handler)
    def stub(*stub_args, **stub_kwargs):
        return user_handler(*stub_args, **stub_kwargs)

    return stub
