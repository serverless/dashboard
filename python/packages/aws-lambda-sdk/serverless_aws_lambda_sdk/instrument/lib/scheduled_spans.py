from .sdk import serverlessSdk

serverlessSdk._deferred_telemetry_requests = []


def flush():
    pass
