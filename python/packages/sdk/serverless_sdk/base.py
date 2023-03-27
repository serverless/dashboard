from __future__ import annotations
from datetime import datetime
from typing import List, Union
import sys
from typing_extensions import Final

if sys.version_info[1] < 8:
    from importlib_metadata import version
else:
    from importlib.metadata import version


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
