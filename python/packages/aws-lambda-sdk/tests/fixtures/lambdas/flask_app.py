import sys
from pathlib import Path

sys.path.append(Path(__file__).parent / "test_dependencies")


from flask import Flask
import serverless_wsgi

app = Flask("__name__")


@app.get("/")
def root():
    return "root"


@app.get("/foo")
def foo():
    return "ok"


@app.post("/test")
def test():
    return "ok"


@app.errorhandler(404)
def not_found(e):
    return {"error": "Not Found"}, 404


def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
