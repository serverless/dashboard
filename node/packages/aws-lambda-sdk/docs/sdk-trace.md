# AWS Lambda SDK Trace

For each function invocation single AWS Lambda SDK Trace is generated.

Before returning the result to AWS Lambda trace payload is written to the console with following log line:

```
SERVERLESS_TELEMETRY.T.<base64 encoded payload>
```

## Trace tags

_Tags exposed on top trace_

| Name          | Value                              |
| ------------- | ---------------------------------- |
| `orgId`       | Serverless Console organization id |
| `service`     | AWS Lambda function name           |
| `sdk.name`    | Name of this package               |
| `sdk.version` | Version of this package            |

## Trace spans

SDK automatically creates following spans, all spans expose [TraceSpan](trace-span.md) interface

### `aws.lambda`

Root span for each function invocation. In case of first invocation it contains two sub spans `aws.lambda.initializaton` and `aws.lambda.invocation`. For following invocations there's just `aws.lambda.invocation` sub span

**Parent:** _None_

#### Tags

##### Always present

| Name                      | Value                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws.lambda.arch`         | Type of computer processor that Lambda uses to run the function. Check [AWS Lambda Architectures](https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html) |
| `aws.lambda.is_coldstart` | Whether it's a cold start invocation                                                                                                                                 |
| `aws.lambda.name`         | AWS Lambda function name                                                                                                                                             |
| `aws.lambda.request_id`   | The identifier of the invocation request                                                                                                                             |
| `aws.lambda.version`      | The version of the function                                                                                                                                          |
| `aws.lambda.outcome`      | The outcome of a function. Possible values are `'success'` and `'error:handled'`                                                                                     |

##### Error case

Tags set in case of `'error:handled'` outcome

| Name                                    | Value             |
| --------------------------------------- | ----------------- |
| `aws.lambda.error_exception_message`    | Error message     |
| `aws.lambda.error_exception_stacktrace` | Error stack trace |

##### AWS API Gateway (v1) REST API endpoint

Tags collected if event comes from AWS API Gateway REST API endpoint configured with `AWS_PROXY` integration type.

| Name                                                     | Value                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `aws.lambda.api_gateway.account_id`                      | Account id of API Gateway                                                           |
| `aws.lambda.api_gateway.api_id`                          | API id                                                                              |
| `aws.lambda.api_gateway.api_stage`                       | API stage                                                                           |
| `aws.lambda.api_gateway.request.id`                      | API Gateway request id                                                              |
| `aws.lambda.api_gateway.request.time_epoch`              | API Gateway request time                                                            |
| `aws.lambda.api_gateway.request.protocol`                | Endpoint protocol (e.g. `HTTP/1.1`)                                                 |
| `aws.lambda.api_gateway.request.domain`                  | Endpoint Domain name                                                                |
| `aws.lambda.api_gateway.request.headers`                 | JSON string of request headers. Multi value headers are stored as arrays            |
| `aws.lambda.api_gateway.request.method`                  | Request method                                                                      |
| `aws.lambda.api_gateway.request.path`                    | Request path                                                                        |
| `aws.lambda.api_gateway.request.path_parameters`         | JSON string of request path parameters                                              |
| `aws.lambda.api_gateway.request.query_string_parameters` | JSON string of query string parameters. Multi value parameters are stored as arrays |

---

### `aws.lambda.initialization`

Covers function initialization phase.

_Can be always accessed at `serverlessSdk.traceSpans.awsLambdaInitialization`_

**Parent**: `aws.lambda`

#### Tags

_None_

---

### `aws.lambda.invocation`

Covers function invocation phase.

_Current invocation span can always be accessed at `serverlessSdk.traceSpans.awsLambdaInvocation`_

**Parent**: `aws.lambda`

#### Tags

_None_
