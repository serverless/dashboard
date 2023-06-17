from __future__ import annotations

from .lib.imports import internally_imported

with internally_imported():
    from datetime import datetime
    from typing import List, Union
    from pathlib import Path
    import sys

    if sys.version_info >= (3, 8):
        from typing import Final
    else:
        from typing_extensions import Final

SLS_ORG_ID: Final[str] = "SLS_ORG_ID"

# module metadata
__name__ = "serverless-sdk"
with open(Path(__file__).parent / "VERSION") as version_file:
    __version__ = version_file.read().strip()


TraceId = str
Nanoseconds = int

TagType = Union[str, int, float, bool, datetime]
TagList = List[TagType]
ValidTags = Union[TagType, TagList]
