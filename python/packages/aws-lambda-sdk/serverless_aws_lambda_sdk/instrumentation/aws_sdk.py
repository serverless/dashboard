from ..lib.instrumentation.aws_sdk.safe_stringify import safe_stringify
from sls_sdk import serverlessSdk
from sls_sdk.lib.instrumentation.import_hook import ImportHook
from wrapt import wrap_function_wrapper, ObjectProxy

_instrumenter = None
_import_hook = ImportHook("botocore")


class Instrumenter:
    target_method = "_make_api_call"

    def __init__(self, botocore):
        self._botocore = botocore

    def install(self, should_monitor_request_response):
        self._should_monitor_request_response = should_monitor_request_response
        wrap_function_wrapper(
            "botocore.client",
            f"BaseClient.{Instrumenter.target_method}",
            self._patched_api_call,
        )

    def uninstall(self):
        _wrapped = getattr(
            self._botocore.client.BaseClient, Instrumenter.target_method, None
        )
        if (
            _wrapped
            and isinstance(_wrapped, ObjectProxy)
            and hasattr(_wrapped, "__wrapped__")
        ):
            setattr(
                self._botocore.client.BaseClient,
                Instrumenter.target_method,
                _wrapped.__wrapped__,
            )

    def _patched_api_call(self, actual_api, instance, args, kwargs):
        (operation_name, api_params) = args
        try:
            service_name = instance.meta.service_model.service_name.lower()
            operation_name = operation_name.lower()
            region_name = instance.meta.region_name
            root_span = serverlessSdk._create_trace_span(
                f"aws.sdk.{service_name}.{operation_name}",
                tags={
                    "aws.sdk.service": service_name,
                    "aws.sdk.operation": operation_name,
                    "aws.sdk.signature_version": "v4",
                    "aws.sdk.region": region_name,
                },
                input=safe_stringify(api_params)
                if self._should_monitor_request_response
                else None,
            )
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
                    message = error.args[0] if error.args else error.__class__.__name__
                    root_span.tags.set("aws.sdk.error", message)
                    response = getattr(error, "response", {})
                if response:
                    root_span.tags.set(
                        "aws.sdk.request_id",
                        response.get("ResponseMetadata", {}).get("RequestId", ""),
                    )
                    if self._should_monitor_request_response:
                        root_span.output = safe_stringify(response)
                root_span.close()
            except Exception as ex:
                serverlessSdk._report_error(ex)


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
