from __future__ import annotations

import inspect
from typing import Callable, Dict

from typing_extensions import TypeAlias


TEST_DEV_MODE_ORG_ID = "test-dev-mode-org-id"
TEST_ORG = "test-org"

ServerlessSdk: TypeAlias = "ServerlessSdk"
Params = Dict[str, inspect.Parameter]


def get_params(func: Callable) -> Params:
    signature = inspect.signature(func)

    return signature.parameters
