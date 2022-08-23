# AWS Lambda SDK Trace

For each function invocation single AWS Lambda SDK Trace is generated.

## Trace tags

_Tags exposed on top trace_

| Name      | Value                              |
| --------- | ---------------------------------- |
| `orgId`   | Serverless Console organization id |
| `service` | AWS Lambda function name           |

## Trace spans

SDK automatically creates following spans, all spans expose [TraceSpan](trace-span.md) interface

### `aws.lambda`

Root span for each function invocation. In case of first invocation it contains two sub spans `aws.lambda.initializaton` and `aws.lambda.invocation`. For following invocations there's just `aws.lambda.invocation` sub span

**Parent:** _None_

#### Tags

| Name                                    | Value                                                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws.lambda.arch`                       | Type of computer processor that Lambda uses to run the function. Check [AWS Lambda Architectures](https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html) |
| `aws.lambda.is_coldstart`               | Whether it's a cold start invocation                                                                                                                                 |
| `aws.lambda.name`                       | AWS Lambda function name                                                                                                                                             |
| `aws.lambda.request_id`                 | The identifier of the invocation request                                                                                                                             |
| `aws.lambda.version`                    | The version of the function                                                                                                                                          |
| `aws.lambda.outcome`                    | The outcome of a function. Possible values are `'success'` and `'error:handled'`                                                                                     |
| `aws.lambda.error_exception_message`    | In case of `'error:handled'` outcome, eventual error message                                                                                                         |
| `aws.lambda.error_exception_stacktrace` | In case of `'error:handled'` outcome, eventual error stack trace                                                                                                     |

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
