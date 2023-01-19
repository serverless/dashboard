from __future__ import annotations

from typing_extensions import Final


class ClassHandler:
    def __call__(self, *args, **kwargs):
        return "ClassHandler"


def handler(*args, **kwargs) -> str:
    return "Handler"


def env_handler(*args, **kwargs) -> str:
    return "Env_Handler"


callable_obj: Final[ClassHandler] = ClassHandler()
