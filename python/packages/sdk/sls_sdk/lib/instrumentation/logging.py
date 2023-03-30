from logging import Logger

from ..error import report as report_error
from ..error_captured_event import create as create_error_captured_event
from ..warning_captured_event import create as create_warning_captured_event


_is_installed = False


_original_error = None
_original_warning = None
_original_warn = None


def _resolve_message(*args) -> str:
    return args[0] % args[1:]


def _error(self, *args, **kwargs):
    _original_error(self, *args, **kwargs)
    try:
        if (
            len(args) == 1
            and type(args[0]) is dict
            and args[0].get("source") == "serverlessSdk"
        ):
            return
        if len(args) == 1 and isinstance(args[0], BaseException):
            message = args[0]
        else:
            message = _resolve_message(*args)
        create_error_captured_event(message, origin="pythonLogging")
    except Exception as ex:
        report_error(ex)


def _warning(call_warn: bool = False):
    def __warning(self, *args, **kwargs):
        if call_warn:
            _original_warn(self, *args, **kwargs)
        else:
            _original_warning(self, *args, **kwargs)

        try:
            if (
                len(args) == 1
                and type(args[0]) is dict
                and args[0].get("source") == "serverlessSdk"
            ):
                return
            create_warning_captured_event(
                _resolve_message(*args), origin="pythonLogging"
            )
        except Exception as ex:
            report_error(ex)

    return __warning


def install():
    global _is_installed
    if _is_installed:
        return
    _is_installed = True

    global _original_error, _original_warning, _original_warn
    _original_error = Logger.error
    _original_warning = Logger.warning
    _original_warn = Logger.warn

    Logger.error = _error
    Logger.warning = _warning()
    Logger.warn = _warning(True)


def uninstall():
    global _is_installed
    if not _is_installed:
        return
    Logger.error = _original_error
    Logger.warning = _original_warning
    Logger.warn = _original_warn
    _is_installed = False
