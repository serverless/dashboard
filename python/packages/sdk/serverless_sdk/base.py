from __future__ import annotations

from datetime import datetime
from typing import List, Union
from importlib.metadata import version
from typing_extensions import Final


FIRST: Final[int] = 0
SLS_ORG_ID: Final[str] = "SLS_ORG_ID"

# module metadata
__name__: Final[str] = "serverless-sdk"
__version__: Final[str] = version(__name__)


TraceId = str
Nanoseconds = int
DateStr = str

TagType = Union[str, int, float, DateStr, bool, datetime]
TagList = List[TagType]
ValidTags = Union[TagType, TagList]
