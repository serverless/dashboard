from __future__ import annotations

from datetime import datetime
from math import inf, nan
from typing import Tuple, Any
from unittest.mock import MagicMock
import pytest
from typing_extensions import Final

from sls_sdk.base import ValidTags
from sls_sdk.exceptions import (
    DuplicateTraceSpanName,
    InvalidTraceSpanTagName,
    InvalidTraceSpanTagValue,
    SdkException,
)
from sls_sdk.lib.tags import ensure_tag_name, ensure_tag_value, Tags
import sls_sdk.lib.tags


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
        assert ensure_tag_name(name)

    for name in INVALID_NAMES:
        with pytest.raises(InvalidTraceSpanTagName):
            ensure_tag_name(name)


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
            assert tags[name] == ensure_tag_value(name, value)

            tags[name] = "new-value"
            assert tags[name] == ensure_tag_value(name, value)


def test_tags_valid_names_and_values_replacement():
    for value in VALID_VALUES:
        tags = Tags()

        for name in VALID_NAMES:
            tags[name] = value
            assert tags[name] == ensure_tag_value(name, value)

            del tags[name]
            tags[name] = "new-value"
            assert tags[name] == ensure_tag_value(name, "new-value")


def test_tags_valid_names_and_null_values():
    tags = Tags()

    for name in VALID_NAMES:
        tags[name] = None
    assert len(tags) == 0


def test_tags_update():
    # given
    input = {"test": 0, "type": "unit"}
    tags = Tags()

    # when
    tags.update(input)

    # then
    assert tags == input


def test_tags_delete():
    # given
    input = {"test": 0, "type": "unit"}
    tags = Tags()
    tags.update(input)

    # when
    del tags["test"]
    del tags["type"]
    del tags["non-existent"]

    # then
    assert tags == {}


def test_tags_update_with_prefix():
    # given
    input = {"a": 0, "b": 1}
    prefix = "test"
    tags = Tags()

    # when
    tags.update(input, prefix=prefix)

    # then
    assert tags == {"test.a": 0, "test.b": 1}


def test_tags_invalid_names_and_values(tags: Tags, monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock)
    for name in INVALID_NAMES:
        for value in VALID_VALUES:
            tags[name] = value

    for name in INVALID_NAMES:
        for value in INVALID_VALUES:
            tags[name] = value

    for name in VALID_NAMES:
        for value in INVALID_VALUES:
            tags[name] = value

    mock.assert_called()


def test_tags_invalid_names_and_values_internal_method_raises_exception(tags: Tags):
    for name in INVALID_NAMES:
        for value in VALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagName):
                tags._set(name, value)

    for name in INVALID_NAMES:
        for value in INVALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagName):
                tags._set(name, value)

    for name in VALID_NAMES:
        for value in INVALID_VALUES:
            with pytest.raises(InvalidTraceSpanTagValue):
                tags._set(name, value)


def test_tags_duplicate(tags: Tags, monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock)
    for name in VALID_NAMES:
        tags[name] = "example"

    for name in VALID_NAMES:
        for value in VALID_VALUES:
            tags[name] = value

    assert mock.call_count == len(VALID_NAMES) * len(VALID_VALUES)


def test_tags_duplicate_same_value(tags: Tags, monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock)

    tags["foo"] = "bar"
    tags["foo"] = "bar"

    tags["baz"] = ["list", "of", "values"]
    tags["baz"] = ["list", "of", "values"]

    mock.assert_not_called()


def test_tags_duplicate_internal_method_raises_exception(tags: Tags):
    for name in VALID_NAMES:
        tags[name] = "example"

    for name in VALID_NAMES:
        for value in VALID_VALUES:
            with pytest.raises(DuplicateTraceSpanName):
                tags._set(name, value)


def test_tags_invalid_names_and_values_bulk(tags: Tags, monkeypatch):
    # given
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock)

    # when
    tags.update({name: "" for name in INVALID_NAMES})

    # then
    mock.assert_called()


def test_tags_invalid_names_and_values_bulk_internal_method_raises_exception(
    tags: Tags, monkeypatch
):
    # given
    mock = MagicMock()
    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock)

    # when
    with pytest.raises(SdkException):
        tags._update({name: "" for name in INVALID_NAMES})
