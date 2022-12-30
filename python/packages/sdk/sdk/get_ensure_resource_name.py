from re import Pattern

from typing_extensions import Final
from js_regex import compile


# from https://github.com/serverless/console/blob/main/node/packages/sdk/lib/get-ensure-resource-name.js#L7
RE: Final[str] = \
    "^[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$"

RE_C: Final[Pattern[str]] = compile(RE)


def is_valid_name(name: str) -> bool:
    match = RE_C.match(name)

    return bool(match)
