from __future__ import annotations

from .imports import internally_imported

with internally_imported():
    from re import Pattern
    from js_regex import compile
    import sys

    if sys.version_info >= (3, 8):
        from typing import Final
    else:
        from typing_extensions import Final

from ..exceptions import InvalidTraceSpanName


# from https://github.com/serverless/console/blob/main/node/packages/sdk/lib/get-ensure-resource-name.js#L7
RE: Final[str] = (
    r"^[a-z][a-z0-9]*"
    r"(?:_[a-z][a-z0-9]*)*"
    r"(?:\.[a-z][a-z0-9]*"
    r"(?:_[a-z][a-z0-9]*)*)*$"
)
RE_C: Final[Pattern] = compile(RE)


def is_valid_name(name: str) -> bool:
    match = RE_C.match(name)

    return bool(match)


def get_resource_name(name: str) -> str:
    if not isinstance(name, str):
        raise InvalidTraceSpanName(
            f"Invalid captured event name: Expected string, received {name}"
        )

    if is_valid_name(name):
        return name

    raise InvalidTraceSpanName(
        "Invalid captured event name: "
        "Name should contain dot separated tokens that follow "
        f'"[a-z][a-z0-9]*" pattern. Received: {name}'
    )
