import json
import sys
from pathlib import Path

sys.path.append(str((Path(__file__).parent / "test_dependencies").resolve()))
from flask import Flask

import serverless_wsgi

sys.path.pop()

app = Flask("__name__")


@app.get("/")
def root():
    return json.dumps("root")


@app.get("/foo")
def foo():
    return json.dumps("ok")


@app.post("/test")
def test():
    return json.dumps("ok")


@app.errorhandler(404)
def not_found(e):
    return {"error": "Not Found"}, 404


def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
