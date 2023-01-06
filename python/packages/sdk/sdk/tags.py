from datetime import datetime
from math import inf
from re import Pattern
from typing import Dict, Tuple

from js_regex import compile
from typing_extensions import Final, get_args

from .base import TagType, ValidTags
from .exceptions import DuplicateTraceSpanName, InvalidTraceSpanTagName, InvalidTraceSpanTagValue


RE: Final[str] = (
    r"/^[a-z][a-z0-9]*"
    r"(?:_[a-z][a-z0-9]*)*"
    r"(?:\.[a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)*)*$/"
)
RE_C: Final[Pattern] = compile(RE)


class Tags(Dict[str, ValidTags]):
    def __setitem__(self, key: str, value: ValidTags):
        name = ensure_tag_name(value)
        value = ensure_tag_value(name, value)

        if name not in self:
            super().__setitem__(name, value)

        current: ValidTags = self[name]

        if isinstance(current, list):
            if value != current:
                return

        raise DuplicateTraceSpanName(
            f"Cannot set tag: Tag {name} is already set"
        )


def is_valid_name(name: str) -> bool:
    match = RE_C.match(name)

    return bool(match)


def is_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True

    except ValueError:
        return False


def ensure_tag_name(attr: str, name: str) -> ValidTags:
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


def ensure_tag_value(attr: str, value: str) -> Tags:
    valid_types: Tuple[type] = get_args(TagType)  # type: ignore
    valid_types = (*valid_types, list)  # type: ignore

    if not isinstance(value, valid_types):
        raise InvalidTraceSpanTagValue(
            f"Invalid trace span tag value for {attr}: Expected string, received {value}"
        )

    if isinstance(value, str) and is_date(value):
        return value

    elif isinstance(value, str):
        return value

    elif isinstance(value, (int, float)):
        if value is inf:
            raise InvalidTraceSpanTagValue(
                f"Invalid trace span tag value for {attr}: "
                f"Number must be finite. Received: {value}"
            )
        return value

    elif isinstance(value, bool):
        return value

    if isinstance(value, list):
        valid: bool = all(ensure_tag_value('tags', item) for item in value)

        if valid:
            return value

    raise InvalidTraceSpanTagValue(
        f"Invalid trace span tag value for {attr}: Expected string, received {value}"
    )
