from .sdk import serverlessSdk

# To limit the concurrency of telemetry requests
_semaphore = None

# To reuse the same session for all telemetry requests for http keep-alive
_session = None


async def init():
    pass


async def send(name, body):
    pass


if serverlessSdk._is_dev_mode:
    import time
    import asyncio
    import requests

    _TELEMETRY_SERVER_URL = "http://localhost:2773/"

    async def _init():
        global _semaphore, _session
        _semaphore = asyncio.Semaphore(10)
        _session = requests.Session()

    async def _send(name, body):
        async with _semaphore:
            request_start_time = time.perf_counter_ns()
            serverlessSdk._debug_log(f"Telemetry send {name}")
            try:
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

    init = _init  # noqa: F811
    send = _send  # noqa: F811
