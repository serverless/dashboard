import google.protobuf


def handler(event, context) -> str:
    if google.protobuf.foo != "bar":
        raise Exception("google.protobuf.foo != 'bar'")
    return "ok"
