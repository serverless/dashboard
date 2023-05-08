from .sdk import serverlessSdk

if serverlessSdk._is_dev_mode:
    import time
    import http.client
    from sls_sdk.lib.instrumentation.http import ignore_following_request

    _connection = None

    _TELEMETRY_SERVER_PORT = 2773

    def close_connection():
        global _connection
        if _connection:
            _connection.close()
            _connection = None

    def send(name: str, body: bytes):
        global _connection
        request_start_time = time.perf_counter_ns()
        serverlessSdk._debug_log(f"Telemetry send {name}")
        try:
            if not _connection:
                _connection = http.client.HTTPConnection(
                    "localhost", _TELEMETRY_SERVER_PORT
                )
                ignore_following_request()

            _connection.request(
                "POST",
                f"/{name}",
                body,
                {
                    "Content-Type": "application/x-protobuf",
                    "Content-Length": str(len(body)),
                },
            )
            response = _connection.getresponse()
            if response.status != 200:
                serverlessSdk._report_warning(
                    "Cannot propagate telemetry, "
                    f'server responded with "{response.status}" status code\n',
                    "DEV_MODE_SERVER_REJECTION",
                )
        except Exception as ex:
            import traceback

            error = "".join(traceback.TracebackException.from_exception(ex).format())
            serverlessSdk._report_warning(
                f"Cannot propagate telemetry: {error}",
                "DEV_MODE_SERVER_ERROR",
            )
        diff = int((time.perf_counter_ns() - request_start_time) / 1000_000)
        serverlessSdk._debug_log(f"Telemetry sent in: {diff}ms")
