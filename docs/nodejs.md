<!--
title: Node.js SDK
menuText: Node.js SDK
description: 
menuOrder: 4
-->

# Node.js SDK

Serverless Console, when Tracing is enabled on an AWS Lambda function, will hook
into the AWS Lambda runtime environment and automatically report Traces and
Spans. To capture handled errors, warnings, and to set custom tags, the SDK
library must be added and instrumented in your AWS Lambda function handler.

## Key terms

- A **Captured Error** is one instance of an `Error` object in Node.js that is
sent to Serverless Console. It can be viewed in Dev Mode or the Trace Explorer
Details.
- A **Captured Warning** is one instance of a string in Node.js that is sent to
Serverless Console, much like a Captured Error.
- A **Tag** is a key/value-pair that can be set on the Trace or an individual
Captured Error or Captured Warning, and sent to Serverless Console. Tags can be
viewed on the Trace Explorer Details and Dev Mode.

## Installation

**Install the package with:**

```javascript
npm install @serverless/sdk --save
# or
yarn add @serverless/sdk
```

**Enable Tracing, Logging, and Dev Mode**

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

**Using captureError**

```javascript
try {
  // an error is thrown
} catch (ex) {
  serverlessSdk.captureError(ex)
}
```


**Using console.error**

```javascript
try {
  // an error is thrown
} catch (ex) {
  console.error(ex)
}
```

The Serverless SDK automatically instruments the `console.error` method to
capture errors. This makes instrumentation much easier as you may already be
using `console.error` to dispaly the errors.

This method only supports capturing Errors, that is, the object must inherit
from the Node.js `Error` object. Passing values of any other type will be
ignored.

### Capturing Warnings

**Using captureWarning**

```javascript
serverlessSdk.captureWarning("Something bad will happen soon")
```

**Using console.warn**

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

### Tagging

**Setting Tags on the Trace**

```javascript
serverlessSdk.setTag("userId", "bd86489cf036")
```

Using the `setTag()` method will create Tags associated with the entire Trace.
You'll be able to see the Tags on the Trace Details page in the Trace Explorer.

All Tags set with `setTag()` are also inherited by all the Captured Errors and
Captured Warnings. 

**Settings Tags with console.error and console.warn**

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

**Setting Tags on Captured Errors**

```javascript
serverlessSdk.captureError(ex, {tags:{userId:"1b8b4c6b4b14"}})
```

Tags can also be set on the individual error. If you previously set a Tag using
`setTag()` then the Tags set on `captureError` will override the Tags on the
Captured Error, while keeping the Tag on the trace unmodified.


**Setting Tags on Captured Warnings**

```javascript
serverlessSdk.captureWarning("warning message", {tags:{userId:"eb661c69405c"}})
```

Tags can also be added on the individual Captured Warnings, just like Captured
Errors.