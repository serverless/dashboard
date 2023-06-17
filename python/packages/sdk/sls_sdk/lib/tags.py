from __future__ import annotations
import re
from datetime import datetime
import json
from math import inf, nan
from re import Pattern
from typing import Dict, List, Mapping, Tuple, Optional, Any
from .imports import internally_imported
from .tag_value import MAX_VALUE_LENGTH

with internally_imported():
    from js_regex import compile

import sys

if sys.version_info >= (3, 8):
    from typing import Final, get_args
else:
    from typing_extensions import Final, get_args
from threading import Lock
from .error import report as report_error
from ..base import TagType, ValidTags
from ..exceptions import (
    DuplicateTraceSpanName,
    InvalidTraceSpanTagName,
    InvalidTraceSpanTagValue,
    SdkException,
)

RE: Final[str] = r"^[a-zA-Z0-9_.-]{1,256}$"
RE_C: Final[Pattern] = compile(RE)


class Tags(Dict[str, ValidTags]):
    def __init__(self):
        super().__init__()
        self._lock = Lock()

    def _set(self, key: str, value: ValidTags):
        if value is None:
            return

        name = ensure_tag_name(key)
        value = ensure_tag_value(name, value)

        with self._lock:
            if name not in self:
                super().__setitem__(name, value)
                return

            current: ValidTags = self[name]
            if value == current:
                return

        raise DuplicateTraceSpanName(f"Cannot set tag: Tag {name} is already set")

    def set(self, key: str, value: ValidTags):
        try:
            self._set(key, value)
        except Exception as ex:
            report_error(ex)

    def __delitem__(self, key: str):
        with self._lock:
            if key in self:
                super().__delitem__(key)

    def __setitem__(self, key: str, value: ValidTags):
        self.set(key, value)

    def _update(
        self, mapping: Mapping[str, ValidTags], prefix: Optional[str] = None
    ) -> None:
        _prefix = ""
        errors = []
        if prefix:
            _prefix = ensure_tag_name(prefix) + "."
        for key, value in mapping.items():
            try:
                self._set(f"{_prefix}{key}", value)
            except Exception as ex:
                errors.append(ex)
        if len(errors) == 0:
            return
        if len(errors) == 1:
            raise errors[0]
        message = "\n\t- ".join(
            map(
                lambda e: e.args[0] if hasattr(e, "args") and len(e.args) else "",
                errors,
            )
        )
        raise SdkException(f"Cannot set Tags:\n\t- {message}")

    def update(
        self, mapping: Mapping[str, ValidTags], prefix: Optional[str] = None
    ) -> None:
        try:
            self._update(mapping, prefix)
        except Exception as ex:
            report_error(ex)


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


def _ensure_singular_tag_value(attr: str, value: TagType) -> TagType:
    valid_types: Tuple[type] = get_args(TagType)  # type: ignore

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
        if len(value.encode()) > MAX_VALUE_LENGTH:
            raise InvalidTraceSpanTagValue(
                f"Invalid trace span tag value for {attr}: "
                f"Too large string: {value}"
            )
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

    raise InvalidTraceSpanTagValue(
        f"Invalid trace span tag value for {attr}: "
        f"Expected {valid_types}, received {value}"
    )


def ensure_tag_value(attr: str, value: ValidTags) -> ValidTags:
    if isinstance(value, List):
        normalized_value = [_ensure_singular_tag_value("tags", item) for item in value]
        if len(json.dumps(normalized_value, default=str).encode()) > MAX_VALUE_LENGTH:
            raise InvalidTraceSpanTagValue(
                f"Invalid trace span tag value for {attr}: "
                f"Too large string: {value}"
            )
        return normalized_value
    else:
        return _ensure_singular_tag_value(attr, value)


def _snake_to_camel_case(string):
    return re.sub(r"_(.)", lambda match: match.group(1).upper(), string)


def convert_tags_to_protobuf(tags: Tags):
    protobuf_tags: Any = {}
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
