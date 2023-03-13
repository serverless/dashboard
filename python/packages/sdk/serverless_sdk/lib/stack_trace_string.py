import traceback
import sys
import inspect
from typing import Optional, Any


def resolve(error: Optional[Any] = None) -> str:
    if isinstance(error, BaseException):
        return "".join(
            traceback.format_exception(
                etype=type(error), value=error, tb=error.__traceback__
            )
        )
    else:
        depth = len(inspect.stack())
        relevant_frame = sys._getframe(3) if depth > 3 else None
        return "".join(traceback.format_stack(f=relevant_frame))
