# Python [`logging module`](https://docs.python.org/3/library/logging.html) instrumentation

_Disable with `SLS_DISABLE_PYTHON_LOG_MONITORING` environment variable_

All `logging.error` invocations are monitored and propagated as [captured errors](../sdk.md#capture_errorerror-tags) to the Serverless Console
