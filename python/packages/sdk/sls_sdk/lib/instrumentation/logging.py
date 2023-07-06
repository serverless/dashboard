from logging import Logger

from ..imports import internally_imported

with internally_imported():
    import json

from ..error import report as report_error
from ..error_captured_event import create as create_error_captured_event
from ..warning_captured_event import create as create_warning_captured_event


_is_installed = False


_original_error = None
_original_warning = None
_original_warn = None


def _resolve_message(msg, *args) -> str:
    msg = str(msg)
    if args:
        msg = msg % args
    return msg


def _error(self, msg, *args, **kwargs):
    try:
        if isinstance(msg, dict) and msg.get("source") == "serverlessSdk" and not args:
            msg = json.dumps(msg, indent=2)
            return
        elif not args and isinstance(msg, BaseException):
            message = msg
        else:
            message = _resolve_message(msg, *args)
        create_error_captured_event(message, origin="pythonLogging")
    except Exception as ex:
        report_error(ex)
    finally:
        _original_error(self, msg, *args, **kwargs)


def _warning(call_warn: bool = False):
    def __warning(self, msg, *args, **kwargs):
        try:
            if (
                isinstance(msg, dict)
                and msg.get("source") == "serverlessSdk"
                and not args
            ):
                msg = json.dumps(msg, indent=2)
                return
            elif not args and isinstance(msg, BaseException):
                message = msg
            else:
                message = _resolve_message(msg, *args)
            create_warning_captured_event(message, origin="pythonLogging")
        except Exception as ex:
            report_error(ex)
        finally:
            if call_warn:
                _original_warn(self, msg, *args, **kwargs)
            else:
                _original_warning(self, msg, *args, **kwargs)

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
