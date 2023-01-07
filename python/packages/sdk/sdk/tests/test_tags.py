from math import inf, nan
from typing import Tuple

import pytest
from typing_extensions import Any, Final

from ..base import ValidTags
from ..exceptions import InvalidTraceSpanTagName, InvalidTraceSpanTagValue
from ..span.tags import ensure_tag_name, ensure_tag_value


VALID_NAMES: Final[Tuple[str, ...]] = (
    "validname",
    "a_b_c.d_e_f",
)

INVALID_NAMES: Final[Tuple[str, ...]] = (
    "invalid name",
    "invalid.name,_999",
    "_invalid.name",
    "Invalid.name",
    "inValid.name",
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
    "2023-01-01",
    [1, 2, 3],
    [1, 2.0, "three", True, False, "2023-01-01"],
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
