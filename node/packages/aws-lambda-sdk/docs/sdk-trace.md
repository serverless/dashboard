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

SDK automatically creates following spans, all spans expose [TraceSpan](https://github.com/serverless/console/tree/main/node/packages/sdk/trace-span.md) interface

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

##### HTTP Endpoint

Tags collected if event is sourced by either:

- AWS API Gateway v1 REST API endpoint configured with `AWS_PROXY` integration type.
- AWS API Gateway v2 HTTP API endpoint configured with either v1 or v2 version of a payload
- AWS Function URL

| Name                                    | Value                                                           |
| --------------------------------------- | --------------------------------------------------------------- |
| `aws.lambda.http.method`                | Request method                                                  |
| `aws.lambda.http.protocol`              | Endpoint protocol (e.g. `HTTP/1.1`)                             |
| `aws.lambda.http.host`                  | Endpoint Domain name                                            |
| `aws.lambda.http.path`                  | Request path                                                    |
| `aws.lambda.http.query_parameter_names` | Query parameter names                                           |
| `aws.lambda.http.request_header_names`  | Request header names                                            |
| `aws.lambda.http.status_code`           | Response status code                                            |
| `aws.lambda.http.error_code`            | Filled, if no or invalid status code is provided by the handler |

##### AWS API Gateway

Tags collected if event is sourced by either:

- AWS API Gateway v1 REST API endpoint configured with `AWS_PROXY` integration type.
- AWS API Gateway v2 HTTP API endpoint configured with either v1 or v2 version of a payload

| Name                                                  | Value                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `aws.lambda.event_source`                             | `"aws.apigateway"`                                                                               |
| `aws.lambda.event_type`                               | `"aws.apigateway.rest"`, `"aws.apigatewayv2.http.v1"` or `"aws.apigatewayv2.http.v2"`            |
| `aws.lambda.api_gateway.account_id`                   | Account id of API Gateway                                                                        |
| `aws.lambda.api_gateway.api_id`                       | API id                                                                                           |
| `aws.lambda.api_gateway.api_stage`                    | API stage                                                                                        |
| `aws.lambda.api_gateway.request.id`                   | API Gateway request id                                                                           |
| `aws.lambda.api_gateway.request.time_epoch`           | API Gateway request time                                                                         |
| `aws.lambda.api_gateway.request.path_parameter_names` | Path parameter names                                                                             |
| `aws.lambda.http_router.path`                         | Route path with unresolved param (potentally overriden by router framework as `express` if used) |

##### Function URL

Tags collected if event is sourced by Function URL

| Name                      | Value              |
| ------------------------- | ------------------ |
| `aws.lambda.event_source` | `"aws.lambda"`     |
| `aws.lambda.event_type`   | `"aws.lambda.url"` |

##### SQS queue message

Tags collected if event is sourced by SQS queue

| Name                         | Value                |
| ---------------------------- | -------------------- |
| `aws.lambda.event_source`    | `"aws.sqs"`          |
| `aws.lambda.event_type`      | `"aws.sqs"`          |
| `aws.lambda.sqs.queue_name`  | Queue name           |
| `aws.lambda.sqs.message_ids` | Array of message ids |

##### SNS topic message

Tags collected if event is sourced by SNS topic subscription

| Name                         | Value                |
| ---------------------------- | -------------------- |
| `aws.lambda.event_source`    | `"aws.sns"`          |
| `aws.lambda.event_type`      | `"aws.sns"`          |
| `aws.lambda.sns.topic_name`  | Topic name           |
| `aws.lambda.sns.message_ids` | Array of message ids |

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
