import inspect
from inspect import Parameter
from types import MappingProxyType
from typing import Callable


Params = MappingProxyType[str, Parameter]


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters
