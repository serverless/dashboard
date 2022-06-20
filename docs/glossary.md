# Glossary

Specific definitions for all terms and concepts used within Serverless Console's product, documentation and related works.

# Metric

Metrics are data about the performance of your applications and its underlying infrastructure.

Metrics in Serverless Console contain tags so that they can be queried via the same tags as Traces and Logs.

In Serverless Console, Metrics are collected, ingested and stored separately from Traces, Logs, and everything else, enabling users to use Metrics without using any other features.

# Logs

Logs in Serverless Console are the logs directly published from your business logic as well as any logs published from your applications' underlying infrastructure.

Logs in Serverless Console contain tags so that they can be queried via the same tags as Traces and Metrics.

In Serverless Console, Logs are collected, ingested and stored separately from Traces, Metrics, and everything else.

# Trace

This is Serverless Console's parent unit of measurement, covering all that happened when your application handled an HTTP request or an AWS Lambda invocation.  A Trace can contain one or many Spans, depending on what it's measuring.

The duration of Traces for AWS Lambda specifically measure the combined duration of AWS Lambda Initialization, Invocation, and Shutdown. Additionally, the duration of the Trace is what AWS Lambda bills for, based on 1ms increments.

It’s important to note that duration of Traces for AWS Lambda is not the same as the performance your users and customers experience when using your AWS Lambda-based application.  The spans of AWS Lambda Initialization and Invocation duration affect your application experience, not the AWS Lambda Shutdown.

## AWS Lambda

### Initialization

This is a Span within a Trace for AWS Lambda that represents the time spent loading your AWS Lambda function and running any initialization code.

Initialization includes the following:

* Initializing all External AWS Lambda Extensions configured on the function (there is a limit of 10 Extensions per function).

* Initializing the AWS Lambda Runtime (e.g, Node.js, Python).

* Initializing the AWS Lambda Function code.

* Initialization only appears for the first event processed by each instance of your function, which is also known as a Cold-Start. It can also appear in advance of function invocations if you have enabled provisioned concurrency.

You will want to optimize Initialization performance as best you can. Poor Initialization performance will directly affect the experience of your users and customers. Additionally, it's important to note that AWS charges you for Initialization time. Unfortunately, no tooling can offer a breakdown of what happens within the Initialization phase of AWS Lambda. Generally, adding multiple Extensions, large code file sizes, and using a slower runtime (e.g., Java) are the biggest culprits when it comes to slow Initialization.

Once initialized, each instance of your function can process thousands of requests without performing another Initialization. However, AWS Lambda function instance containers will shutdown within 5-15 minutes of inactivity. After that, the next event will be a Cold-Start, causing Initialization to run again.

### Invocation  

This is a Span within a Trace for AWS Lambda.  After Initialization, Extensions and the handler of the AWS Lambda function run in the Invocation phase. This phase includes:

* Running External Extensions in parallel with the function. These also continue running after the function has completed, enabling Serverless Console to capture diagnostic information and ingest metrics, traces and logs.

* Running the wrapper logic for Internal Extensions.

* Running the handler for your AWS Lambda.

The Invocation phase is comprised mostly of your handler (i.e. your business logic), and you want to optimize that as best you can because its performance (combined with Initialization performance) will have the biggest impact on the experience for your users and customers.

Serverless Console provides a lot of auto-instrumentation for measuring Spans within the Invocation span, such as requests to other AWS Services and HTTP calls generally.

It's important to note that your function's timeout setting limits the duration of the entire Invocation phase. For example, if you set the function timeout as 360 seconds, the function and all extensions need to complete within 360 seconds.

### Shutdown

This phase of AWS Lambda which unfortunately cannot be measured by observability tools.  This phase is run when AWS Lambda is about to shut down the runtime.

This phase includes:

* Running cleanup tasks in Extensions.

Additional time is allocated to your AWS Lambda function's timeout limit for Shutdown.

# Benchmark

A Benchmark is a general way of describing the results of running a test against a Use-Case and specific Variations thereof.

## Use-Case

A Benchmark Use-Case represents a common use-case we want to measure via a Benchmark.

For example, measuring the performance of sending an AWS Lambda function using Node.js + Express.js is a Benchmark Use-Case.

## Variant

A Benchmark Use-Case Variant is a variation of a Benchmark Use-Case that we wish to run a Benchmark for independently to observe something specific.  

Every Benchmark Use-Case can have one of multiple Variations. 

For example, measuring the performance of an AWS Lambda function using Node.js + Express.js is a Benchmark Use-Case, and measuring it during an AWS Lambda Cold-Start, an AWS Lambda Warm-Start, are Variations.

## Report

A report detailing and summarizing the results of running Benchmarks against different Use-Case Variations, published by Serverless Inc.
