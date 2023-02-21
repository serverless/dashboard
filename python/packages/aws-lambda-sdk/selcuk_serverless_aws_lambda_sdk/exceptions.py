from __future__ import annotations

from typing_extensions import NoReturn, Self

from strenum import StrEnum


class LambdaError(StrEnum):
    """Lambda Runtime errors"""

    BUILT_IN_MODULE_CONFLICT: Self = "Runtime.BuiltInModuleConflict"
    HANDLER_NOT_FOUND: Self = "Runtime.HandlerNotFound"
    IMPORT_MODULE_ERROR: Self = "Runtime.ImportModuleError"
    LAMBDA_CONTEXT_UNMARSHAL_ERROR: Self = "Runtime.LambdaContextUnmarshalError"
    MALFORMED_HANDLER_NAME: Self = "Runtime.MalformedHandlerName"
    MARSHAL_ERROR: Self = "Runtime.MarshalError"
    UNMARSHAL_ERROR: Self = "Runtime.UnmarshalError"
    USER_CODE_SYNTAX_ERROR: Self = "Runtime.UserCodeSyntaxError"


class LambdaSdkException(Exception):
    """Base class for all exceptions raised by the SDK."""

    pass


class HandlerNotFound(LambdaSdkException):
    error: LambdaError = LambdaError.HANDLER_NOT_FOUND


class MalformedHandlerName(LambdaSdkException):
    error: LambdaError = LambdaError.MALFORMED_HANDLER_NAME


class BuiltInModuleConflict(LambdaSdkException):
    error: LambdaError = LambdaError.BUILT_IN_MODULE_CONFLICT


class ImportModuleError(LambdaSdkException):
    error: LambdaError = LambdaError.IMPORT_MODULE_ERROR


class UserCodeSyntaxError(LambdaSdkException):
    error: LambdaError = LambdaError.USER_CODE_SYNTAX_ERROR


def handler_not_found(basename: str = "SDK", message: str = "") -> NoReturn:
    raise HandlerNotFound(f"{basename} {message}")
