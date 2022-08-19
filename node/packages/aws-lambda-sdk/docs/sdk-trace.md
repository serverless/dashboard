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

_None_

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
