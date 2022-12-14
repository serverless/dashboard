# HTTP(S) requests

_Disable with `SLS_DISABLE_HTTP_MONITORING` environment variable_

All HTTP and HTTPS requests are monitored and stored as `node.http.request` & `node.https.request` trace spans.

## Trace span tags:

| Name                         | Value                                           |
| ---------------------------- | ----------------------------------------------- |
| `http.method`                | Request method (e.g. `GET`)                     |
| `http.protocol`              | Currently `HTTP/1.1` in all cases               |
| `http.host`                  | Domain name and port name if custom             |
| `http.path`                  | Request pathname (query string is not included) |
| `http.query_parameter_names` | Query string parameter names (if provided)      |
| `http.request_header_names`  | Request header names                            |
| `http.status_code`           | Response status code                            |
| `http.error_code`            | If request errored, its error code              |

# Request and response data

In developer mode, additionally request and response bodies are monitored. That can be disabled with `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` environment variable
