from .sdk import serverlessSdk

# To reuse the same session for all telemetry requests for http keep-alive
_session = None


def send(name, body):
    pass


if serverlessSdk._is_dev_mode:
    import time
    import requests

    _TELEMETRY_SERVER_URL = "http://localhost:2773/"

    def _send(name: str, body: bytes):
        request_start_time = time.perf_counter_ns()
        serverlessSdk._debug_log(f"Telemetry send {name}")
        try:
            global _session
            if not _session:
                _session = requests.Session()

            response = _session.get(
                _TELEMETRY_SERVER_URL + name,
                headers={
                    "Content-Type": "application/x-protobuf",
                    "Content-Length": str(len(body)),
                },
                data=body,
                stream=False,
            )
            if response.status_code != 200:
                serverlessSdk._report_warning(
                    "Cannot propagate telemetry, "
                    f'server responded with "{response.status_code}" status code\n',
                    "DEV_MODE_SERVER_REJECTION",
                )
        except Exception as ex:
            serverlessSdk._report_warning(
                f"Cannot propagate telemetry: {ex}", "DEV_MODE_SERVER_ERROR"
            )

        diff = int((time.perf_counter_ns() - request_start_time) / 1000_000)
        serverlessSdk._debug_log(f"Telemetry sent in: {diff}ms")

    send = _send  # noqa: F811
