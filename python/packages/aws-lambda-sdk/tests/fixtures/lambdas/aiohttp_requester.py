import time
import asyncio
import sys
from pathlib import Path


TEST_SERVER_PORT = 3177
httpd = None


def run_http_server():
    global httpd, TEST_SERVER_PORT
    import http.server
    import socketserver

    class MyTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    Handler = http.server.SimpleHTTPRequestHandler
    with MyTCPServer(("", TEST_SERVER_PORT), Handler) as httpd:
        httpd.serve_forever(0.1)


def make_http_request(url):
    sys.path.append(Path(__file__).parent / "test_dependencies")
    import aiohttp

    async def _request():
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"someHeader": "bar"}) as resp:
                await resp.text()

    asyncio.run(_request())
    sys.path.pop()


def handler(event, context) -> str:
    url = event.get("url")
    if url:
        make_http_request(url)
    else:
        from threading import Thread

        server_thread = Thread(target=run_http_server)
        server_thread.start()

        for i in range(10):
            time.sleep(0.1)
            try:
                make_http_request(f"http://127.0.0.1:{TEST_SERVER_PORT}/?foo=bar")
                break
            except ConnectionRefusedError:
                print(f"client: connection refused on {TEST_SERVER_PORT}")

        if httpd:
            httpd.shutdown()
        server_thread.join()
    return "ok"


if __name__ == "__main__":
    handler({}, None)
