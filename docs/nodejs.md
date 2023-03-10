<!--
title: Node.js SDK
menuText: Node.js SDK
description: 
menuOrder: 5
-->

# Node.js SDK

Serverless Console, when Instrumentation is enabled on an AWS Lambda function,
will hook into the AWS Lambda runtime environment and automatically report
metrics, traces, spans, and events. To capture handled errors, warnings, and to
set custom tags, the SDK library must be added and instrumented in your AWS
Lambda function handler.

## Key terms

- An **Event** is an instance of an error, warning, or notice that is captured
as a part of a Trace. Multiple events can be captured in a single trace.
- A **Captured Error** is a one instance of an error that is sent to Serverless
Console as an Event. It can be viewed in Dev Mode or the Trace Explorer Details.
- A **Captured Warning** is one instance of a string in Node.js that is sent to
Serverless Console as an Event, much like a Captured Error.
- A **Tag** is a key/value-pair that can be set on the Trace or an individual
Event, and sent to Serverless Console. Tags can be viewed on the Trace Explorer
Details and Dev Mode.

## Compatibility

While Serverless Console is developed by the makers of the Serverless Framework,
the entire Serverless Console product and this SDK are 100% agnostic of the
deployment tool you use. Serverless Console and this SDK work just as well with
Terraform, CDK, SAM, Pulumi, etc, as as they do with Serverless Framework.

## Installation

### Install the package

When Tracing is enabled in Serverless Console, an  AWS Lambda Layer is added to
your AWS Lambda function with the `@serverless/sdk` package. While the AWS
Lambda layer is added by Serverless Console, it is possible for the layer to be
removed temporarily if you deploy manually or with some infrastructure as code
tools. As such, we recommend bundling the SDK with your handler to avoid
unresolved references to the SDK.

```
npm install @serverless/sdk --save
# or
yarn add @serverless/sdk
```

### Using a bundler

If you use a bundler, like esbuild, the AWS Lambda Layer for Serverless Console
will instrument native Node.js APIs like `http` and `console`, and APIs
available on the runtime like the AWS SDK; however, if the handler bundles APIs,
like `express` or the AWS SDK, then Serverless Console will not be able to
auto-instrument. To enable auto-instrumentation for these APIs, you will need to
manually add the AWS-specific auto-instrumentation library and initiate
auto-instrumentation.

Install the `@serverless/aws-lambda-sdk` package locally. This replaces
the need for the `@serverless/sdk` package, so you do not need both.

```
npm install @serverless/aws-lambda-sdk --save
# or
yarn add @serverless/aws-lambda-sdk
```

Use the following methods to instrument the AWS client libraries and Express.js.

```javascript
const serverlessSdk = require("@serverless/aws-lambda-sdk");

// Instrument AWS SDK v2
serverlessSdk.instrumentation.awsSdkV2.install(AWS)

// Instrument AWS SDK v3 client
serverlessSdk.instrumentation.awsSdkV3Client.install(client)

// instruments Express.js
serverlessSdk.instrumentation.expressApp.install(expressApp)
```

### Enable Tracing, Logging, and Dev Mode

The SDK will merely generate the necessary Tags, Captured Errors, and Captured
Warnings; however, Tracing, Logging, and Dev Mode must be enabled on your org on
Serverless Console in order for the data to be ingested.

[Enable Tracing, Logging, and Dev Mode](/console/docs/integrations/enable-monitoring-features)

## Usage

The package does not require any configuration as the credentials are
automatically set on the AWS Lambda function environment variables when Tracing
is enabled in Serverless Console.

To use the Serverless SDK you must require the `@serverless/sdk` method in your
AWS Lambda function handler.

```javascript
const serverlessSdk = require("@serverless/sdk");
```

### Capturing Errors

The most common use case for the Serverless SDK is to capture handled errors.
There are two mechanisms for capturing handled errors.

#### Using captureError

```javascript
try {
  // an error is thrown
} catch (ex) {
  serverlessSdk.captureError(ex)
}
```

#### Using console.error

```javascript
try {
  // an error is thrown
} catch (ex) {
  console.error(ex)
}
```

The Serverless SDK automatically instruments the `console.error` method to
capture errors. This makes instrumentation much easier as you may already be
using `console.error` to display the errors.

This method can be used to capture `Error` objects, as well as any combination
of strings. If only an `Error` object is provided, then the stack trace in
Console will show the stack trace of the error object. If a string, or a
combination of a string and `Error`, are provided, then then stack trace of the
`console.error` will be captured.

### Capturing Warnings

#### Using captureWarning

```javascript
serverlessSdk.captureWarning("Something bad will happen soon")
```

#### Using console.warn

```javascript
console.warn("My Warning")
```

The Serverless SDK automatically instruments the `console.warn` method to
capture warnings. This makes instrumentation easier as you may already be using
`console.warn` to display warnings.

This method only supports capturing strings.

We recommend avoiding using unique instance values for the strings. For example,
if you need to include a userId, email, request ID, or any ID that may be unique
to the individual invocation, we recommend using Tagging instead.

This method will capture the stack trace of the `console.warn` call so it
is easy to identify in Console.

### Tagging

#### Setting Tags on the Trace

```javascript
serverlessSdk.setTag("userId", "bd86489cf036")
```

Using the `setTag()` method will create Tags associated with the entire Trace.
You'll be able to see the Tags on the Trace Details page in the Trace Explorer
and the Invocation Started/Stopped even on Dev Mode.

All Tags set with `setTag()` are also inherited by all the Captured Errors and
Captured Warnings. 

Tag keys may only contain alphanumeric, `.`, `-`, and `_` characters. Tag values
may contain any string value. Invalid tag keys will not throw errors, instead,
an SDK error will be made available in Dev Mode and Trace Details.

#### Settings Tags with console.error and console.warn

```javascript
serverlessSdk.setTag("userId", "bd86489cf036")
console.warn("warning message")
console.error(new Error("some error"))
```

Using `setTag()` sets the Tag values on both the Trace and all Captured Errors
and Captured Warnings. Captured Errors and Captured Warnings can be created
using the `console.error` and `console.warn` methods. Therefore, Tags set with
`setTag()` will therefore apply to all Captured Errors and Captured Warnings
created using `console.error` and `console.warn`.

#### Setting Tags on Captured Errors

```javascript
serverlessSdk.captureError(ex, {tags:{userId:"1b8b4c6b4b14"}})
```

Tags can also be set on the individual error. If you previously set a Tag using
`setTag()` then the Tags set on `captureError` will override the Tags on the
Captured Error, while keeping the Tag on the trace unmodified.

Tag keys on `captureError` are validated the same way as tag keys on `setTag()`.


#### Setting Tags on Captured Warnings

```javascript
serverlessSdk.captureWarning("warning message", {tags:{userId:"eb661c69405c"}})
```

Tags can also be added on the individual Captured Warnings, just like Captured
Errors.

Tag keys on `captureWarning` are validated the same way as tag keys on
`setTag()`.

### Structured Logs with captureError and captureWarning

The `captureWarning` and `captureError` methods will send the content to
Serverless Console in a binary format. To enable human-readability these
methods will also output a structured-log JSON string, like the one shown
below.

This string is easier to read, and can also be used with other tools like
CloudWatch Log Insights to parse and search.

```javascript
{
  "source": "serverlessSdk",
  "type": "ERROR_TYPE_CAUGHT_USER",
  "message": "User not found",
  "stackTrace": "...",
  "tags": { 
    "userId": "eb661c69405c"
   }
}
```

To disable the output of the structured logs with `captureError` and
`captureWarning`, set this environment variable in the runtime.

```bash
SLS_DISABLE_CAPTURED_EVENTS_STDOUT=true
```
