from __future__ import annotations
import re
from datetime import datetime
from math import inf, nan
from re import Pattern
from typing import Dict, List, Mapping, Tuple, Optional

from js_regex import compile
from typing_extensions import Final, get_args

from ..base import TagType, ValidTags
from ..exceptions import (
    DuplicateTraceSpanName,
    InvalidTraceSpanTagName,
    InvalidTraceSpanTagValue,
)

# from https://github.com/serverless/console/blob/fe64a4f53529285e89a64f7d50ec9528a3c4ce57/node/packages/sdk/lib/tags.js#L12
RE: Final[str] = r"^[a-zA-Z0-9_.-]+$"
RE_C: Final[Pattern] = compile(RE)


class Tags(Dict[str, ValidTags]):
    def __setitem__(self, key: str, value: ValidTags):
        if value is None:
            return

        name = ensure_tag_name(key)
        value = ensure_tag_value(name, value)

        if name not in self:
            super().__setitem__(name, value)
            return

        current: ValidTags = self[name]

        if isinstance(current, list):
            if value != current:
                return

        raise DuplicateTraceSpanName(f"Cannot set tag: Tag {name} is already set")

    def update(self, mapping: Mapping[str, ValidTags], prefix: Optional[str] = None) -> None:
        _prefix = ""
        if prefix:
            _prefix = ensure_tag_name(prefix) + "."
        for key, value in mapping.items():
            self[f"{_prefix}{key}"] = value


def is_valid_name(name: str) -> bool:
    match = RE_C.match(name)

    return bool(match)


def is_date(value: str) -> bool:
    try:
        datetime.fromisoformat(value)
        return True

    except ValueError:
        return False


def ensure_tag_name(name: str) -> str:
    if not isinstance(name, str):
        raise InvalidTraceSpanTagName(
            f"Invalid trace span tag {name}: Expected string, received {name}"
        )

    if is_valid_name(name):
        return name

    raise InvalidTraceSpanTagName(
        f"Invalid trace span tag {name}: {name.capitalize()} "
        f"should contain dot separated tokens that follow "
        f'"[a-z][a-z0-9_]*" pattern. Received {name}'
    )


def ensure_tag_value(attr: str, value: str) -> ValidTags:
    valid_types: Tuple[type] = get_args(TagType)  # type: ignore
    valid_types = (*valid_types, list)  # type: ignore

    if not isinstance(value, valid_types):
        raise InvalidTraceSpanTagValue(
            f"Invalid trace span tag value for {attr}: "
            f"Expected {valid_types}, received {value}"
        )

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, str) and is_date(value):
        return value

    elif isinstance(value, str):
        return value

    elif isinstance(value, (int, float)):
        invalid = inf, -inf, nan

        if value in invalid:
            raise InvalidTraceSpanTagValue(
                f"Invalid trace span tag value for {attr}: "
                f"Number must be finite. Received: {value}"
            )

        return value

    elif isinstance(value, bool):
        return value

    if isinstance(value, List):
        valid: bool = all(ensure_tag_value("tags", item) is not None for item in value)

        if valid:
            return value

    raise InvalidTraceSpanTagValue(
        f"Invalid trace span tag value for {attr}: "
        f"Expected {valid_types}, received {value}"
    )


def _snake_to_camel_case(string):
    return re.sub(r"_(.)", lambda match: match.group(1).upper(), string)


def convert_tags_to_protobuf(tags: Tags):
    protobuf_tags = {}
    for key, value in tags.items():
        context = protobuf_tags
        key_tokens = key.split(".")
        key_tokens = [_snake_to_camel_case(token) for token in key_tokens]
        last_token = key_tokens.pop()
        for token in key_tokens:
            if token not in context:
                context[token] = {}
            context = context[token]
        context[last_token] = value
    return protobuf_tags
