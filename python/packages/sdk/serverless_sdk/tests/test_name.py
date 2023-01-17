from __future__ import annotations

from typing_extensions import Final
import pytest

from ..exceptions import InvalidTraceSpanName
from ..span.name import get_resource_name, is_valid_name


VALID_NAME: Final[str] = "valid.name"
INVALID_NAME: Final[str] = "This isn't a valid name"


def test_is_valid_name():
    assert is_valid_name(VALID_NAME)
    assert not is_valid_name(INVALID_NAME)


def test_get_resource_name():
    assert get_resource_name(VALID_NAME) == VALID_NAME

    with pytest.raises(InvalidTraceSpanName):
        get_resource_name(INVALID_NAME)

    with pytest.raises(InvalidTraceSpanName):
        get_resource_name(None)

    with pytest.raises(InvalidTraceSpanName):
        as_bytes: bytes = VALID_NAME.encode()
        get_resource_name(as_bytes)
