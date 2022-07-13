# AWS Lambda: Node.js

AWS Lambda is a serverless compute service that lets you run code without provisioning or managing servers.  You can measure Metrics, Traces and Logs of AWS Lambda via Serverless Console.

# Trace

## `aws-lambda`

The Trace for an AWS Lambda specifically measures the combined lifecyle phased of AWS Lambda Initialization, Invocation, and Shutdown, and any logic performed within the Invocation phase.

Additionally, the duration of the Trace is what AWS Lambda bills for, based on 1ms increments. Duration charges apply to initialization code that is declared outside of the handler in the Initiatlization phase, code that runs in the handler of a function during the Invocation phase, as well as the time it takes for code in any last running Extensions to finish executing during Shutdown phase.

It’s important to note that duration of Traces for AWS Lambda is not the same as the performance your users and customers experience when using your AWS Lambda-based application. The Spans of AWS Lambda Initialization and Invocation duration affect your application experience, not the AWS Lambda Shutdown.

### Tags

These are the Tags attached to this Trace:

```javascript

/* Tags: Metadata */

s.sdk.name: "s-aws-lambda-nodejs",
s.sdk.version: "0.0.1",
s.org.id: "53121673-361f-4181-3411-53e031312c09",
s.platform: "aws-lambda",
s.environment: "prod",
s.namespace: "api",
s.service: "aws-api-prod-getPoster",
s.region: "us-east-1",

/* Tags: Standard */
 
duration: 1032, // Maps to the AWS Lambda Cloudwatch Logs Report "Billed Duration"

/* Tags: AWS */

aws.account.id: "670455222476",
aws.resource.arn: "arn:aws:lambda:us-east-1:423234:function:aws-api-prod-getPoster",

/* Tags: AWS Lambda */

aws.lambda.arch: "x64",
aws.lambda.coldstart: false,
aws.lambda.duration: 1032, // Maps to the Cloudwatch Logs Report "Billed Duration"
aws.lambda.error: false,
aws.lambda.error_culprit: "null",
aws.lambda.error_exception_message: "null",
aws.lambda.error_exception_stacktrace: "null",
aws.lambda.error_exception_type: "null",
aws.lambda.event_source: "aws.apigateway",
aws.lambda.error_timeout: false,
aws.lambda.event_type: "aws.apigatewayv2.http",
aws.lambda.log_group: "/aws/lambda/aws-api-prod-getMoviePoster",
aws.lambda.log_stream_name: "2022/07/13/[$LATEST]3f82942bb5e9484d87899e3b4cc0719e",
aws.lambda.max_memory: "1024",
aws.lambda.name: "aws-api-prod-getPoster",
aws.lambda.request_id: "2be6c182-955a-4da9-9c39-d9e9d9febbaa",
aws.lambda.request_time_epoch: 1657743048772,
aws.lambda.version: "$LATEST",
aws.lambda.xray_trace_id: "Root=1-62136c8-56d0adcsafa323790afa;Parent=16b66safasf23e2ab3794;Sampled=0",

// Optional AWS Lambda Tags
aws.lambda.api_gateway_api_id: "pagbl1123133b91",
aws.lambda.api_gateway_request_id: "2be123182-951a-4d139-9f49-d913f1231abaa",
aws.lambda.domain: "api.planetmojo.io",
aws.lambda.method: "GET",
aws.lambda.path: "/collectible/movie-poster/metadata/{id}",
aws.lambda.raw_path: "/collectible/movie-poster/metadata/2293",
aws.lambda.status_code: 200,
```

# Spans

## `initialization`

This is a Span within a Trace for AWS Lambda that represents the time spent loading your AWS Lambda function and running any initialization code.

Initialization includes the following:

Extension Init – Initializing all External AWS Lambda Extensions configured on the function (there is a limit of 10 Extensions per function).

Runtime Init – Initializing the AWS Lambda Runtime (e.g, Node.js, Python).

Function Init – Initializing the AWS Lambda Function code.

Initialization only appears for the first event processed by each instance of your function, which is also known as a Cold-Start. It can also appear in advance of function invocations if you have enabled provisioned concurrency.

You will want to optimize Initialization performance as best you can. Poor Initialization performance will directly affect the experience of your users and customers. Additionally, it's important to note that AWS charges you for Initialization time. Unfortunately, no tooling can offer a breakdown of what happens within the Initialization phase of AWS Lambda. Generally, adding multiple Extensions, large code file sizes, and using a slower runtime (e.g., Java) are the biggest culprits when it comes to slow Initialization.

Once initialized, each instance of your function can process thousands of requests without performing another Initialization. However, AWS Lambda function instance containers will shutdown within 5-15 minutes of inactivity. After that, the next event will be a Cold-Start, causing Initialization to run again.

### Tags

These are the Tags attached to this Span:

```javascript

/* Tags: Standard */
 
duration: 600, // Maps to the AWS Lambda Cloudwatch Logs Report "Init Duration"
```

## `invocation`

This is a Span within a Trace for AWS Lambda. After Initialization, Extensions and the handler of the AWS Lambda function run in the Invocation phase. This phase includes:

Running External Extensions in parallel with the function. These also continue running after the function has completed, enabling Serverless Console to capture diagnostic information and ingest metrics, traces and logs.

Running the wrapper logic for Internal Extensions.

Running the handler for your AWS Lambda.

The Invocation phase is comprised mostly of your handler (i.e. your business logic), and you want to optimize that as best you can because its performance (combined with Initialization performance) will have the biggest impact on the experience for your users and customers.

Serverless Console provides a lot of auto-instrumentation for measuring Spans within your business logic, which is located within the Invocation span, such as requests to other AWS Services and HTTP calls generally.

It's important to note that your function's timeout setting limits the duration of the entire Invocation phase. For example, if you set the function timeout as 360 seconds, the function and all extensions need to complete within 360 seconds.

### Tags

These are the Tags attached to this Span:


```javascript

/* Tags: Standard */

duration: 432, // Maps to the AWS Lambda Cloudwatch Logs Report "Duration"
```

## `aws-sdk`

If you use the `aws-sdk` module in Node.js to interact with another service, this Span is created.

```javascript

/* Tags: Standard */
 
duration: 231

/* Tags: aws-sdk */

aws.sdk.region: 'eu-west-1' // Region name for the request
aws.sdk.signature_version: "v4" // AWS version of authentication signature on the request.
aws.sdk.service: "S3" // The name of the service to which a request is made, as returned by the AWS SDK.
aws.sdk.operation: "PutObject" // The name of the operation corresponding to the request, as returned by the AWS SDK.
aws.sdk.request_id: "01234123123567-89aab-cde4f-0123-af919asf" // Request unique ID, as returned from AWS on response.
aws.sdk.error: "UriParameterError: Expected uri parameter to have length >= 1, but found "" for params.Bucket" // Information about a service or networking error, as returned from AWS
```

## `http`

If you use the `http` module in Node.js, this Span is created.

### Tags

These are the Tags attached to this Span:

```javascript

/* Tags: Standard */
 
duration: 231

/* Tags: http */

node.http.url: "http://myapp.com"
node.http.method: "get"
node.http.path: "/helloworld"
node.http.status_code: 401
```

## `https`

If you use the `https` module in Node.js, this Span is created.

### Tags

These are the Tags attached to this Span:

```javascript

/* Tags: Standard */
 
duration: 331

/* Tags: https */

node.https.url: "http://myapp.com"
node.https.method: "get"
node.https.path: "/helloworld"
node.https.status_code: 500
```

## `express`

If an HTTP request is made from your AWS Lambda function, a Span is created.

### Tags

These are the Tags attached to this Span:

```javascript

/* Tags: Standard */
 
duration: 291

/* Tags: express */

express.method: "get"
express.path: "/helloworld"
express.status_code: 200
```

