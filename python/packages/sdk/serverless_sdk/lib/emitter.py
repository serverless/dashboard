from blinker import Signal
from typing import Callable
from typing_extensions import Literal

EVENT_TYPE = Literal["captured-event", "trace-span-close"]


class EventEmitter:
    def __init__(self):
        # create a dictionary of event to signal mappings
        self._signals = dict([(event, Signal()) for event in EVENT_TYPE.__args__])

    def on(self, event: Literal[EVENT_TYPE], func: Callable):
        self._signals[event].connect(func)

    def emit(self, event: Literal[EVENT_TYPE], *args, **kwargs):
        self._signals[event].send(*args, **kwargs)


event_emitter = EventEmitter()
