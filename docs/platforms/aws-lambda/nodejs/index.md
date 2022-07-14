# AWS Lambda: Node.js

AWS Lambda is a serverless compute service that lets you run code without provisioning or managing servers.  You can measure Metrics, Traces and Logs of AWS Lambda via Serverless Console.  

# Tracing

If you use Serverless Console's AWS Lambda Extension for Node.js, it will automatically trace your AWS Lambda invocations, providing a timeline rich with information we curated to help you assess, optimize and troubleshoot, as well as trace services and data that triggered your AWS Lambda functions.

Every AWS Lambda function invocation instrumented with our Extension generates a Trace.  This Trace contains the following Spans, some of which are optional depending on the modules you use within your code.  We put great effort into enriching this Trace with Tags useful for debugging across code, AWS Services and more.

Here is a table of contents of Spans we currently capture, in an example hierarchical format:

* **aws.lambda**
  * **aws.lambda.initialization**
  * **aws.lambda.invocation**
    * **express**
      * **node.https**
      * **node.http**
      * **aws.sdk**

# Spans

## `aws.lambda`

This is the parent Span (aka the Trace) for an AWS Lambda. It measures the combined lifecyle phases of AWS Lambda Initialization and Invocation, and any logic performed within the Invocation phase.

Additionally, the duration of this Span is what AWS Lambda bills for, based on 1ms increments. Duration charges apply to initialization code that is declared outside of the handler in the Initiatlization phase, code that runs in the handler of a function during the Invocation phase, as well as the time it takes for code in any last running Extensions to finish executing during Shutdown phase.

It’s important to note that duration of this Span for AWS Lambda is not the same as the performance your users and customers experience when using your AWS Lambda-based application. The Spans of AWS Lambda Initialization and Invocation duration affect your application experience, not the AWS Lambda Shutdown.

### Tags

These are the Tags attached to this Span:

```javascript
/* Tags: Standard */

s.sdk.name: "s-aws-lambda-nodejs"
s.sdk.version: "0.0.1"
s.org.id: "53121673-361f-4181-3411-53e031312c09"
s.platform: "aws-lambda"
s.environment: "prod"
s.namespace: "api"
s.service: "aws-api-prod-getPoster"
s.region: "us-east-1"
s.trace.id: "db8e08ae5e6c71c35320ddad5ffb56a5"
s.span.id: "e8a4e2a264145041" // This Span's ID
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: aws */

aws.account.id: "670455222476"
aws.resource.arn: "arn:aws:lambda:us-east-1:423234:function:aws-api-prod-getPoster"

/* Tags: aws.xray */

aws.xray.trace_id: "Root=1-62136c8-56d0adcsafa323790afa;Parent=16b66safasf23e2ab3794;Sampled=0" // Optional. If available

/* Tags: aws.lambda */

aws.lambda.arch: "x64"
aws.lambda.coldstart: false
aws.lambda.duration: 1032 // Maps to the Cloudwatch Logs Report "Billed Duration"
aws.lambda.error: false
aws.lambda.error_culprit: "null"
aws.lambda.error_exception_message: "null"
aws.lambda.error_exception_stacktrace: "null"
aws.lambda.error_exception_type: "null"
aws.lambda.event_source: "aws.apigateway"
aws.lambda.error_timeout: false
aws.lambda.event_type: "aws.apigatewayv2.http"
aws.lambda.log_group: "/aws/lambda/aws-api-prod-getMoviePoster"
aws.lambda.log_stream_name: "2022/07/13/[$LATEST]3f82942bb5e9484d87899e3b4cc0719e"
aws.lambda.max_memory: 1024
aws.lambda.name: "aws-api-prod-getPoster"
aws.lambda.request_id: "2be6c182-955a-4da9-9c39-d9e9d9febbaa"
aws.lambda.request_time_epoch: 1657743048772
aws.lambda.version: "$LATEST"

/* Tags: http - Optional. If the Lambda is handling HTTP requests via any method (API Gateway, Function URLs, code-defined routes in Express.js), we will auto-inspect those methods and attempt to populate these tags */

http.protocol: "HTTP/1.1" // Must be in this format
http.domain: "api.planetmojo.io"
http.method: "GET"
http.path: "/collectible/movie-poster/metadata/{id}" // Must not include parameterized values, only variables.
http.status_code: 200

/* Tags: aws.api_gateway - Optional. If the function is handling an API Gateway event.  This data is consistently collected across all API Gateway event versions */

aws.api_gateway.account.id: "123456789012"
aws.api_gateway.api.id: "pagbl1123133b91"
aws.api_gateway.api.stage: "prod"
aws.api_gateway.request.id: "2be123182-951a-4d139-9f49-d913f1231abaa"
aws.api_gateway.request.time: 1583798639428 // Epoch format
aws.api_gateway.request.protocol: "HTTP/1.1"
aws.api_gateway.request.domain: "70ixmpl4fl.execute-api.us-east-2.amazonaws.com"
aws.api_gateway.request.headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        "cookie": "s_fid=7AAB6XMPLAFD9BBF-0643XMPL09956DE2; regStatus=pre-register",
        "X-Amzn-Trace-Id": "Root=1-5e66d96f-7491f09xmpl79d18acf3d050",
        "X-Forwarded-For": "52.255.255.12",
        "X-Forwarded-Port": "443",
        "X-Forwarded-Proto": "https"
    }
aws.api_gateway.request.method: "GET"
aws.api_gateway.request.path: "/users"
aws.api_gateway.request.pathParameters: { "userID": 712308019 } // Defaults to {}
aws.api_gateway.request.query_string_parameters: { "number": 9 } // Defaults to {}

/* Tags: aws.sqs - Optional. If the function is handling an SQS event */

aws.sqs.queue_name: "MyQueue" // Taken from the eventSourceARN
aws.sqs.operation: "receive" // Must be "receive"
aws.sqs.message_ids: ["fja98jafs"] // Introspected from the events records

/* Tags: aws.sns - Optional. If the function is handling an SNS event */

aws.sns.topic.name: "sns-lambda" // Taken from the TopicArn
aws.sns.operation: "receive" // Must be "receive"
aws.sns.message_ids: ["fja98jafs"] // Introspected from the events records
```

## `aws.lambda.initialization`

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

s.span.id: "ja819kasfj10asfh" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: aws.lambda */
 
aws.lambda.initialization.duration: 600 // Maps to the Cloudwatch Logs Report "Init Duration"
```

## `aws.lambda.invocation`

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

s.span.id: "91ashafj0a91hasf" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: aws.lambda */

aws.lambda.invocation.duration: 432 // Maps to the Cloudwatch Logs Report "Duration"
```

## `aws.sdk.<service>.<operation>`

If you use the `aws-sdk` module in Node.js to interact with an AWS service, this Span is created.

The title of the Span is all lowercase.

```javascript
/* Tags: Standard */

s.span.id: "80asjsaf10asdf" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: aws.sdk */

aws.sdk.region: 'eu-west-1' // Region name for the request
aws.sdk.signature_version: "v4" // AWS version of authentication signature on the request.
aws.sdk.service: "S3" // The name of the service to which a request is made, as returned by the AWS SDK.
aws.sdk.operation: "PutObject" // The name of the operation corresponding to the request, as returned by the AWS SDK.
aws.sdk.request_id: "01234123123567-89aab-cde4f-0123-af919asf" // Request unique ID, as returned from AWS on response.
aws.sdk.error: "UriParameterError: Expected uri parameter to have length >= 1, but found "" for params.Bucket" // Information about a service or networking error, as returned from AWS
```

### `aws.sdk.dynamodb.batchgetitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users", ...]
```

### `aws.sdk.dynamodb.batchwriteitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users", ...]
```

### `aws.sdk.dynamodb.deleteitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
```

### `aws.sdk.dynamodb.describetable`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
```

### `aws.sdk.dynamodb.getitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
aws.dynamodb.projection: "Title, Description, RelatedItems, ProductReviews" // The value of the ProjectionExpression request parameter.
```

### `aws.sdk.dynamodb.putitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
```

### `aws.sdk.dynamodb.query`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
aws.dynamodb.scan_forward: true // The value of the ScanIndexForward request parameter.
aws.dynamodb.attributes_to_get: ["lives", "id"] // The value of the AttributesToGet request parameter.
aws.dynamodb.consistent_read: true // The value of the ConsistentRead request parameter.
aws.dynamodb.index_name: "my_index" // The value of the IndexName request parameter.
aws.dynamodb.limit: 50 // The value of the Limit request parameter.
aws.dynamodb.projection: "Title, Description, RelatedItems, ProductReviews" // The value of the ProjectionExpression request parameter.
aws.dynamodb.select: "ALL_ATTRIBUTES" // The value of the Select request parameter.
```


### `aws.sdk.dynamodb.scan`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
aws.dynamodb.segment: 10 // The value of the Segment request parameter.
aws.dynamodb.total_segments: 100 // The value of the TotalSegments request parameter.
aws.dynamodb.count: 5 // The value of the Count request parameter
aws.dynamodb.scanned_count: 5 // The value of the ScannedCount request parameter.
aws.dynamodb.attributes_to_get: ["lives", "id"] // The value of the AttributesToGet request parameter.
aws.dynamodb.consistent_read: true // The value of the ConsistentRead request parameter.
aws.dynamodb.index_name: "my_index" // The value of the IndexName request parameter.
aws.dynamodb.limit: 50 // The value of the Limit request parameter.
aws.dynamodb.projection: "Title, Description, RelatedItems, ProductReviews" // The value of the ProjectionExpression request parameter.
aws.dynamodb.select: "ALL_ATTRIBUTES" // The value of the Select request parameter.
```

### `aws.sdk.dynamodb.updateitem`

If you use the `aws-sdk` module in Node.js with AWS DynamoDB and perform this operation these Tags are added to the Span:

```javascript
/* Tags: aws.dynamodb */

aws.dynamodb.table_names: ["Users"]
```

### `aws.sdk.sqs.sendmessage`

If you use the `aws-sdk` module in Node.js with AWS SQS and perform a `SendMessage` operation these Tags are added to the Span:

```javascript
/* Tags: aws.sqs */

aws.sqs.queue_name: "MyQueue" // Taken from the Queue URL
aws.sqs.operation: "send" // Must be "send"
aws.sqs.message_ids: ["fja98jafs"] // An array with the message ID provided in the SDK operation response.  Must be an array.
```

### `aws.sdk.sqs.sendmessagebatch`

If you use the `aws-sdk` module in Node.js with AWS SQS and perform a `SendMessageBatch` operation these Tags are added to the Span:

```javascript
/* Tags: aws.sqs */

aws.sqs.queue_name: "MyQueue" // Taken from the Queue URL
aws.sqs.operation: "send" // Must be "send"
aws.sqs.message_ids: ["fja98jafs", ...] // An array with the message IDs provided in the SDK operation response.
```

### `aws.sdk.sns.publish`

If you use the `aws-sdk` module in Node.js with AWS SNS and perform a `Publish` operation these Tags are added to the Span:

```javascript
/* Tags: aws.sns */

aws.sns.topic.name: "sns-lambda" // Taken from the TopicArn
aws.sns.operation: "send" // Must be "send"
aws.sns.message_ids: ["fja98jafs"] // Introspected from the response of this SDK operation
```

### `aws.sdk.sns.publishbatch`

If you use the `aws-sdk` module in Node.js with AWS SNS and perform a `PublishBatch` operation these Tags are added to the Span:

```javascript
/* Tags: aws.sns */

aws.sns.topic.name: "sns-lambda" // Taken from the TopicArn
aws.sns.operation: "send" // Must be "send"
aws.sns.message_ids: ["fja98jafs", ...] // Introspected from the response of this SDK operation
```

## `node.http`

If you use the `http` module in Node.js, this Span is created.

### Tags

These are the Tags attached to this Span:

```javascript
/* Tags: Standard */

s.span.id: "jf0asf90j1jasf" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: node.http */

node.http.url: "http://myapp.com"
node.http.method: "get"
node.http.path: "/helloworld"
node.http.status_code: 401
```

## `node.https`

If you use the `https` module in Node.js, this Span is created.

### Tags

These are the Tags attached to this Span:

```javascript
/* Tags: Standard */

s.span.id: "91901jasjfsaofj" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: node.https */

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

s.span.id: "19asjfasf0j1ja" // This Span's ID
s.span.parent.id: "e8a4e2a264145041" // This Span's parent Span ID.
s.span.timestamp: "2022-07-13T20:10:48.794945024Z" // This Span's time.  Same as start_time.
s.span.start_time: "2022-07-13T20:10:48.794945024Z" // This Span's start time.
s.span.end_time: "2022-07-13T20:10:48.799375104Z" // This Span's end time.

/* Tags: express */

express.method: "get"
express.path: "/helloworld"
express.status_code: 200
```

