import time

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


def make_http_request(host, path, use_ssl=False):
    import http.client

    conn = None

    try:
        if use_ssl:
            conn = http.client.HTTPSConnection(host)
        else:
            conn = http.client.HTTPConnection(host)
        conn.request("GET", path, headers={"someHeader": "bar"})
        response = conn.getresponse()
        response.read()
    finally:
        if conn:
            conn.close()


def handler(event, context) -> str:
    url = event.get("url")
    if url:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        make_http_request(
            parsed.netloc, url.split(parsed.netloc)[1], use_ssl=parsed.scheme == "https"
        )
    else:
        from threading import Thread

        server_thread = Thread(target=run_http_server)
        server_thread.start()

        for i in range(10):
            time.sleep(0.1)
            try:
                make_http_request(f"127.0.0.1:{TEST_SERVER_PORT}", "/?foo=bar")
                break
            except ConnectionRefusedError:
                print(f"client: connection refused on {TEST_SERVER_PORT}")

        if httpd:
            httpd.shutdown()
        server_thread.join()
    return "ok"


if __name__ == "__main__":
    handler({}, None)
