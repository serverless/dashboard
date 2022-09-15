# AWS Lambda SDK internal flow monitoring

## Request and response data

_DIsable with `SLS_DISABLE_REQUEST_MONITORING` and `SLS_DISABLE_RESPONSE_MONITORING` environment variables respectively_

SDK reads and writes to logs request (lambda event) and response data. This data is written with a log line looking as:

```
SERVERLESS_TELEMETRY.R.<base64 encoded payload>
```

## HTTP(S) requests

_Disable with `SLS_DISABLE_HTTP_MONITORING` environment variable_

All HTTP and HTTPS requests are monitored and stored as `node.http.request` & `node.https.request` trace spans

#### Trace span tags:

| Name                  | Value                                           |
| --------------------- | ----------------------------------------------- |
| `http[s].method`      | Request method (e.g. `GET`)                     |
| `http[s].protocol`    | Currently `HTTP/1.1` in all cases               |
| `http[s].host`        | Domain name and port name if custom             |
| `http[s].path`        | Request pathname (query string is not included) |
| `http[s].query`       | Query string (if provided)                      |
| `http[s].status_code` | Response status code                            |
| `http[s].error_code`  | If request errored, its error code              |
