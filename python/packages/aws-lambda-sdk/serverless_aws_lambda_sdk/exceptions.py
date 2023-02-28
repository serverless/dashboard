from __future__ import annotations

from typing_extensions import Self

from strenum import StrEnum


class LambdaError(StrEnum):
    """Lambda Runtime errors"""

    HANDLER_NOT_FOUND: Self = "Runtime.HandlerNotFound"


class LambdaSdkException(Exception):
    """Base class for all exceptions raised by the SDK."""

    pass


class HandlerNotFound(LambdaSdkException):
    error: LambdaError = LambdaError.HANDLER_NOT_FOUND
