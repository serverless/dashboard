from typing_extensions import Final
from re import Pattern

from js_regex import compile

from .exceptions import InvalidName, InvalidType


RE: Final[str] = (
    r"/^[a-z][a-z0-9]*"
    r"(?:_[a-z][a-z0-9]*)*"
    r"(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$/"
)
RE_C: Final[Pattern] = compile(RE)


def is_valid_name(name: str) -> bool:
    match = RE_C.match(name)

    return bool(match)


def ensure_tag_name(attr: str, name: str) -> str:
    if not isinstance(name, str):
        raise InvalidType(f"Invalid trace span tag {attr}: Expected string, received {name}")

    if is_valid_name(name):
        return name

    raise InvalidName(
        f"Invalid trace span tag {attr}: {attr.capitalize()} "
        f"should contain dot separated tokens that follow "
        f'"[a-z][a-z0-9_]*" pattern. Received {name}'
    )
