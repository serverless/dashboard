import traceback
import sys
from typing import Optional, Any


def resolve(error: Optional[Any] = None) -> str:
    if isinstance(error, Exception):
        return "".join(
            traceback.format_exception(
                etype=type(error), value=error, tb=error.__traceback__
            )
        )
    else:
        previous_frame = sys._getframe(1)
        return traceback.format_stack(f=previous_frame)
