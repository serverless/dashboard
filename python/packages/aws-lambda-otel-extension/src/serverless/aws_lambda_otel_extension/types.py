# Based on/Yanked from:
# https://github.com/awslabs/aws-lambda-powertools-python/tree/develop/aws_lambda_powertools/utilities/typing

from typing import Any, Dict


class LambdaCognitoIdentity(object):

    _cognito_identity_id: str
    _cognito_identity_pool_id: str

    @property
    def cognito_identity_id(self) -> str:
        return self._cognito_identity_id

    @property
    def cognito_identity_pool_id(self) -> str:
        return self._cognito_identity_pool_id


class LambdaClientContextMobileClient(object):

    _installation_id: str
    _app_title: str
    _app_version_name: str
    _app_version_code: str
    _app_package_name: str

    @property
    def installation_id(self) -> str:
        return self._installation_id

    @property
    def app_title(self) -> str:
        return self._app_title

    @property
    def app_version_name(self) -> str:
        return self._app_version_name

    @property
    def app_version_code(self) -> str:
        return self._app_version_code

    @property
    def app_package_name(self) -> str:
        return self._app_package_name


class LambdaClientContext(object):
    _client: LambdaClientContextMobileClient
    _custom: Dict[str, Any]
    _env: Dict[str, Any]

    @property
    def client(self) -> LambdaClientContextMobileClient:
        return self._client

    @property
    def custom(self) -> Dict[str, Any]:
        return self._custom

    @property
    def env(self) -> Dict[str, Any]:
        return self._env


class LambdaContext(object):

    _function_name: str
    _function_version: str
    _invoked_function_arn: str
    _memory_limit_in_mb: int
    _aws_request_id: str
    _log_group_name: str
    _log_stream_name: str
    _identity: LambdaCognitoIdentity
    _client_context: LambdaClientContext

    @property
    def function_name(self) -> str:
        return self._function_name

    @property
    def function_version(self) -> str:
        return self._function_version

    @property
    def invoked_function_arn(self) -> str:
        return self._invoked_function_arn

    @property
    def memory_limit_in_mb(self) -> int:
        return self._memory_limit_in_mb

    @property
    def aws_request_id(self) -> str:
        return self._aws_request_id

    @property
    def log_group_name(self) -> str:
        return self._log_group_name

    @property
    def log_stream_name(self) -> str:
        return self._log_stream_name

    @property
    def identity(self) -> LambdaCognitoIdentity:
        return self._identity

    @property
    def client_context(self) -> LambdaClientContext:
        return self._client_context

    @staticmethod
    def get_remaining_time_in_millis() -> int:
        return 0
