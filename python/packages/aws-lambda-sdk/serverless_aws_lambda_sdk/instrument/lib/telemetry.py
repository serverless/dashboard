from .sdk import serverlessSdk

if serverlessSdk._is_dev_mode:
    import time
    import aiohttp

    _session = None

    _TELEMETRY_SERVER_URL = "http://localhost:2773/"

    async def close_session():
        global _session
        if _session:
            await _session.close()
            _session = None

    async def open_session():
        global _session
        conn = aiohttp.TCPConnector(limit=10)
        _session = aiohttp.ClientSession(connector=conn)

    async def send_async(name: str, body: bytes):
        request_start_time = time.perf_counter_ns()
        serverlessSdk._debug_log(f"Telemetry send {name}")
        try:
            async with _session.get(
                _TELEMETRY_SERVER_URL + name,
                data=body,
                headers={
                    "Content-Type": "application/x-protobuf",
                    "Content-Length": str(len(body)),
                },
            ) as response:
                if response.status != 200:
                    serverlessSdk._report_warning(
                        "Cannot propagate telemetry, "
                        f'server responded with "{response.status}" status code\n',
                        "DEV_MODE_SERVER_REJECTION",
                    )
        except Exception as ex:
            serverlessSdk._report_warning(
                f"Cannot propagate telemetry: {ex}", "DEV_MODE_SERVER_ERROR"
            )
        diff = int((time.perf_counter_ns() - request_start_time) / 1000_000)
        serverlessSdk._debug_log(f"Telemetry sent in: {diff}ms")
