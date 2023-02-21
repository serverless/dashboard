# Go SDK

Go SDK reports Traces, Captured Errors and Captured Warnings to Serverless Console
from the AWS lambda Go runtime environment. The SDK library must be added and
instrumented in your AWS Lambda function handler.

## Key terms

- A **Captured Error** is one instance of an error that is sent to Serverless
  Console. It can be viewed in the Trace Explorer Details.
- A **Captured Warning** is one instance of a string that is sent to
  Serverless Console, much like a Captured Error.

## Compatibility

While Serverless Console is developed by the makers of the Serverless Framework,
the entire Serverless Console product and this SDK are 100% agnostic of the
deployment tool you use. Serverless Console and this SDK work just as well with
Terraform, CDK, SAM, Pulumi, etc, as they do with Serverless Framework.

## Installation

### Install the package

To instrument your Lambda function code you just need to replace
`"github.com/aws/aws-lambda-go/lambda"` import with `"github.com/serverless/console/go/packages/slslambda"`.

Before:

```go
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	lambda.Start(handle)
}

func handle() {}
```

After:

```go
package main

import (
	"github.com/serverless/console/go/packages/slslambda"
)

func main() {
	slslambda.Start(handle)
}

func handle() {}
```

### Enable Logging

Logging must be enabled on your org in Serverless Console in order for the data to be ingested.

[Enable Tracing, Logging, and Dev Mode](/console/docs/integrations/enable-monitoring-features)

### Set environment variable

The package does require `SLS_ORG_ID` environment variable to be set in your Lambda function.
You must do that manually using AWS API or AWS Console.

## Capturing Errors

```go
slslambda.CaptureError(ctx, err)
```

## Capturing Warnings

```go
slslambda.CaptureWarning(ctx, "something bad will happen soon")
```

## Example
You can find a working example in the `example` directory.
