from re import Pattern

from js_regex import compile
from typing_extensions import Final

from .base import Tag
from .exceptions import InvalidTraceSpanTagName, InvalidTraceSpanTagValue


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
        raise InvalidTraceSpanTagName(
            f"Invalid trace span tag {attr}: Expected string, received {name}"
        )

    if is_valid_name(name):
        return name

    raise InvalidTraceSpanTagName(
        f"Invalid trace span tag {attr}: {attr.capitalize()} "
        f"should contain dot separated tokens that follow "
        f'"[a-z][a-z0-9_]*" pattern. Received {name}'
    )


def ensure_tag_value(attr: str, value: str) -> str:
    if not isinstance(value, Tag):
        raise InvalidTraceSpanTagValue(
            f"Invalid trace span tag value for {attr}: Expected string, received {value}"
        )

    return value
