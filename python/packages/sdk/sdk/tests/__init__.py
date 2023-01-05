from __future__ import annotations

from types import MappingProxyType
from typing import Callable
from typing_extensions import TypeAlias
import inspect


import pytest


ServerlessSdk: TypeAlias = "ServerlessSdk"
Params = MappingProxyType[str, inspect.Parameter]


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters


@pytest.fixture
def sdk() -> ServerlessSdk:
    from .. import serverlessSdk

    return serverlessSdk
