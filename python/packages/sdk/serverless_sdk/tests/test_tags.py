from __future__ import annotations

from datetime import datetime
from math import inf, nan
from typing import Tuple, Any

import pytest
from typing_extensions import Final

from ..base import ValidTags
from ..exceptions import (
    DuplicateTraceSpanName,
    InvalidTraceSpanTagName,
    InvalidTraceSpanTagValue,
)
from ..span.tags import ensure_tag_name, ensure_tag_value, Tags


VALID_NAMES: Final[Tuple[str, ...]] = (
    "validname",
    "a_b_c.d_e_f",
    "a_b_c1.d_e_f2",
    "Valid.Name",
    "Valid_name",
)

INVALID_NAMES: Final[Tuple[str, ...]] = (
    "invalid name",
    "invalid.name,_999",
    "?invalid.name",
)


VALID_VALUES: Final[Tuple[ValidTags, ...]] = (
    "valid value",
    0.123456,
    1233456,
    0,
    0.0,
    -10,
    -10.0,
    True,
    False,
    datetime.now(),
    [1, 2, 3],
    [1, 2.0, "three", True, False, datetime.now()],
)


INVALID_VALUES: Final[Tuple[Any, ...]] = (
    None,
    1j,
    inf,
    -inf,
    nan,
    [1, 2, "three", None, inf],
    b"invalid",
)


ATTR: Final[str] = "attr"


@pytest.fixture
def tags() -> Tags:
    return Tags()


def test_ensure_tag_name():
    for name in VALID_NAMES:
        assert ensure_tag_name(ATTR, name)

    for name in INVALID_NAMES:
        with pytest.raises(InvalidTraceSpanTagName):
            ensure_tag_name(ATTR, name)


def test_ensure_tag_value():
    for value in VALID_VALUES:
        assert ensure_tag_value(ATTR, value) is not None

    for value in INVALID_VALUES:
        with pytest.raises(InvalidTraceSpanTagValue):
            ensure_tag_value(ATTR, value)


def test_tags_valid_names_and_values():
    for value in VALID_VALUES:
        tags = Tags()

        for name in VALID_NAMES:
            tags[name] = value


def test_tags_invalid_names_and_values(tags: Tags):
    for name in INVALID_NAMES:
        for value in VALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagName):
                tags[name] = value

    for name in INVALID_NAMES:
        for value in INVALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagName):
                tags[name] = value

    for name in VALID_NAMES:
        for value in INVALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagValue):
                tags[name] = value


def test_tags_duplicate(tags: Tags):
    for name in VALID_NAMES:
        tags[name] = "example"

    for name in VALID_NAMES:
        for value in VALID_VALUES:
            with pytest.raises(DuplicateTraceSpanName):
                tags[name] = value
