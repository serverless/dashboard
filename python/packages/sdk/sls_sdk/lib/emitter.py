import sys
from typing import Callable

if sys.version_info >= (3, 8):
    from typing import Literal
else:
    from typing_extensions import Literal

EVENT_TYPE = Literal["captured-event", "trace-span-close"]


class EventEmitter:
    def __init__(self):
        # create a dictionary of event to signal mappings
        self._signals = dict([(event, []) for event in EVENT_TYPE.__args__])

    def on(self, event: Literal[EVENT_TYPE], func: Callable):
        if func not in self._signals[event]:
            self._signals[event].append(func)

    def emit(self, event: Literal[EVENT_TYPE], *args, **kwargs):
        for func in self._signals[event]:
            func(*args, **kwargs)


event_emitter = EventEmitter()
