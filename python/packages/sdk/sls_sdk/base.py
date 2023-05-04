from __future__ import annotations

from datetime import datetime
from typing import List, Union

from typing_extensions import Final


SLS_ORG_ID: Final[str] = "SLS_ORG_ID"

# module metadata
__name__ = "serverless-sdk"
__version__ = "0.4.5"


TraceId = str
Nanoseconds = int
DateStr = str

TagType = Union[str, int, float, DateStr, bool, datetime]
TagList = List[TagType]
ValidTags = Union[TagType, TagList]
