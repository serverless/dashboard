import gzip
from serverless_sdk_schema import TracePayload
import base64


TARGET_LOG_PREFIX = "SERVERLESS_TELEMETRY.TZ."


def deserialize_trace(trace):
    return TracePayload.FromString(gzip.decompress(base64.b64decode(trace)))
