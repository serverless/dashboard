import traceback
import sys
import inspect
from typing import Optional, Any


def resolve(error: Optional[Any] = None) -> str:
    if isinstance(error, BaseException):
        # in case of an actual Exception, stack trace is already set up.
        return "".join(
            traceback.format_exception(
                etype=type(error), value=error, tb=error.__traceback__
            )
        )
    else:
        # in case of errors that are not exceptions, return the current stack trace
        # but exclude the most recent 3 frames to make sure stack trace ends at
        # customer's code and does not include SDK internal methods.
        depth = len(inspect.stack())
        relevant_frame = sys._getframe(3) if depth > 3 else None
        return "".join(traceback.format_stack(f=relevant_frame))
