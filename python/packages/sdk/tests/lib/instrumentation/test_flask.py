import pytest
from threading import Thread
from importlib import reload

TEST_SERVER_PORT = 3177


@pytest.fixture()
def instrumentation_setup(reset_sdk):
    import sls_sdk.lib.instrumentation.flask

    sls_sdk.lib.instrumentation.flask.install()
    yield
    sls_sdk.lib.instrumentation.flask.uninstall()


@pytest.fixture()
def app(instrumentation_setup):
    from werkzeug.serving import make_server

    server_thread = None

    class ServerThread(Thread):
        def __init__(self, app):
            super().__init__()
            self.server = make_server("127.0.0.1", TEST_SERVER_PORT, app)

        def run(self):
            self.server.serve_forever()

        def shutdown(self):
            self.server.shutdown()

    def start_server():
        from flask import Flask

        app = Flask("__name__")

        @app.route("/")
        def hello_world():
            return "ok"

        @app.post("/internal-server-error")
        def internal_error():
            class CustomException(Exception):
                pass

            raise CustomException("Internal Server Error")

        @app.errorhandler(404)
        def page_not_found(e):
            return "not found", 404

        nonlocal server_thread
        server_thread = ServerThread(app)
        server_thread.start()
        return server_thread

    server_thread = start_server()
    yield server_thread
    server_thread.join()


def test_flask_get_200(app):
    # given
    import requests
    from sls_sdk import serverlessSdk

    request_body = {"foo": "bar"}

    # when
    response = requests.get(
        f"http://127.0.0.1:{TEST_SERVER_PORT}/",
        headers={"User-Agent": "foo"},
        data=request_body,
    )
    app.shutdown()

    # then
    assert response.status_code == 200
    assert response.content == b"ok"
    root = serverlessSdk.trace_spans.root
    assert [s.name for s in root.spans] == ["flask", "flask.route.get.helloworld"]


def test_flask_post_500(app):
    # given
    import requests
    from sls_sdk import serverlessSdk

    request_body = {"foo": "bar"}
    events = []

    def _on_event(event):
        events.append(event)

    serverlessSdk._event_emitter.on("captured-event", _on_event)

    # when
    response = requests.post(
        f"http://127.0.0.1:{TEST_SERVER_PORT}/internal-server-error",
        headers={"User-Agent": "foo"},
        data=request_body,
    )
    app.shutdown()

    # then
    assert response.status_code == 500
    root = serverlessSdk.trace_spans.root
    assert [s.name for s in root.spans] == [
        "flask",
        "flask.route.post.internalerror",
        "flask.error.customexception",
    ]
    assert events[0].tags["error.name"] == "CustomException"


def test_flask_get_404(app):
    # given
    import requests
    from sls_sdk import serverlessSdk, ServerlessSdkSettings

    serverlessSdk._settings = ServerlessSdkSettings()

    request_body = {"foo": "bar"}
    events = []

    def _on_event(event):
        events.append(event)

    serverlessSdk._event_emitter.on("captured-event", _on_event)

    # when
    response = requests.get(
        f"http://127.0.0.1:{TEST_SERVER_PORT}/not-found",
        headers={"User-Agent": "foo"},
        data=request_body,
    )
    app.shutdown()

    # then
    assert response.status_code == 404
    assert response.content == b"not found"
    root = serverlessSdk.trace_spans.root
    assert [s.name for s in root.spans] == [
        "flask",
        "flask.error.notfound",
    ]
    assert events[0].tags["error.name"] == "NotFound"


def test_flask_original_behaviour_restored_after_uninstall(app):
    # given
    import requests
    from sls_sdk import serverlessSdk

    request_body = {"foo": "bar"}

    # when
    response = requests.get(
        f"http://127.0.0.1:{TEST_SERVER_PORT}/not-found",
        headers={"User-Agent": "foo"},
        data=request_body,
    )

    # then
    assert response.status_code == 404
    assert response.content == b"not found"
    root = serverlessSdk.trace_spans.root
    assert [s.name for s in root.spans] == [
        "flask",
        "flask.error.notfound",
    ]

    # given
    import sls_sdk.lib.instrumentation.flask

    sls_sdk.lib.instrumentation.flask.uninstall()

    import sls_sdk.lib.trace

    reload(sls_sdk.lib.trace)

    assert sls_sdk.lib.trace.root_span is None

    # when
    response = requests.get(
        f"http://127.0.0.1:{TEST_SERVER_PORT}/not-found",
        headers={"User-Agent": "foo"},
        data=request_body,
    )
    app.shutdown()

    # then
    assert sls_sdk.lib.trace.root_span is None
