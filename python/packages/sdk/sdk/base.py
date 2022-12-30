from typing import List, Union


TraceId = str
Nanoseconds = int
DateStr = str

Tag = Union[str, int, float, DateStr, bool]
Tags = List[Tag]
ValidTags = Union[Tag, Tags]
