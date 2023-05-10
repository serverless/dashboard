from ..lib.instrumentation.aws_sdk.safe_stringify import safe_stringify
from ..lib.instrumentation.aws_sdk.service_mapper import get_mapper_for_service
from sls_sdk import serverlessSdk
from sls_sdk.lib.instrumentation.import_hook import ImportHook
from sls_sdk.lib.instrumentation.http import (
    ignore_following_request,
    reset_ignore_following_request,
)
from sls_sdk.lib.instrumentation.wrapper import replace_method
import re
import importlib

_instrumenter = None
_import_hook = ImportHook("botocore")


def _sanitize_span_name(name):
    return re.sub(r"^\d+", "", re.sub(r"[^0-9a-zA-Z]", "", name)).lower()


class Instrumenter:
    target_method = "_make_api_call"

    def __init__(self, botocore):
        self._botocore_client = importlib.import_module("botocore.client")

    def install(self, should_monitor_request_response):
        self._should_monitor_request_response = should_monitor_request_response
        replace_method(
            self._botocore_client.BaseClient,
            Instrumenter.target_method,
            self._patched_api_call,
        )

    def uninstall(self):
        _wrapped = getattr(
            self._botocore_client.BaseClient, Instrumenter.target_method, None
        )
        if hasattr(_wrapped, "__wrapped__"):
            setattr(
                self._botocore_client.BaseClient,
                Instrumenter.target_method,
                _wrapped.__wrapped__,
            )

    def _patched_api_call(self, actual_api, instance, args, kwargs):
        (operation_name, api_params) = args
        try:
            ignore_following_request()
            try:
                sanitized_service_name = _sanitize_span_name(
                    instance.meta.service_model.service_name
                )
                sanitized_operation_name = _sanitize_span_name(operation_name)
                region_name = instance.meta.region_name

                tag_mapper = get_mapper_for_service(sanitized_service_name)

                root_span = serverlessSdk._create_trace_span(
                    f"aws.sdk.{sanitized_service_name}.{sanitized_operation_name}",
                    tags={
                        "aws.sdk.service": sanitized_service_name,
                        "aws.sdk.operation": sanitized_operation_name,
                        "aws.sdk.signature_version": "v4",
                        "aws.sdk.region": region_name,
                    },
                    input=safe_stringify(api_params)
                    if self._should_monitor_request_response
                    else None,
                )
                if tag_mapper:
                    tag_mapper.params(root_span, api_params)
            except Exception as ex:
                serverlessSdk._report_error(ex)
                return actual_api(*args, **kwargs)

            error, response = None, None
            try:
                response = actual_api(*args, **kwargs)
                return response
            except Exception as ex:
                error = ex
                raise error
            finally:
                try:
                    if error:
                        message = (
                            error.args[0] if error.args else error.__class__.__name__
                        )
                        root_span.tags.set("aws.sdk.error", message)
                        response = getattr(error, "response", {})
                    if response:
                        root_span.tags.set(
                            "aws.sdk.request_id",
                            response.get("ResponseMetadata", {}).get("RequestId", ""),
                        )
                        if self._should_monitor_request_response:
                            root_span.output = safe_stringify(response)
                        if tag_mapper:
                            tag_mapper.response_data(root_span, response)
                    root_span.close()
                except Exception as ex:
                    serverlessSdk._report_error(ex)
        finally:
            reset_ignore_following_request()


def _hook(botocore):
    global _instrumenter
    _instrumenter = Instrumenter(botocore)
    _instrumenter.install(
        serverlessSdk._is_dev_mode
        and not serverlessSdk._settings.disable_request_response_monitoring
    )


def _undo_hook(botocore):
    global _instrumenter
    _instrumenter.uninstall()
    _instrumenter = None


def install():
    if _import_hook.enabled:
        return

    _import_hook.enable(_hook)


def uninstall():
    if not _import_hook.enabled:
        return

    _import_hook.disable(_undo_hook)
