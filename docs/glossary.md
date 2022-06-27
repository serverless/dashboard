<!--
title: Glossary
menuText: Glossary
description: 
menuOrder: 4
-->

# Glossary
Serverless Console is built on a simple set of observability concepts that work
across all types of apps - no matter how they are built or managed. We built
Console on the three pillars of observability - [Logs](product/logs.md), 
[Metrics](product/metrics.md) and [Traces](product/traces.md).

The following definitions provide context on how these terms are used 
in the documentation and serves as a starting point for learning
about the Serverless Console.

# Serverless
Serverless Console is optimized for use in Function as a Service (FAAS) platforms, specifically
[AWS Lambda](#aws-lambda). That said, we define Serverless as any pay-for-usage
managed service and plan to offer more platforms and services in the near future. [Contact Sales](https://www.serverless.com/sales) if you'd like to learn more about our Road Map.

# Logs
[Logs](product/logs.md) are collected directly from your application and
are avialble both streaming and in [Traces](product/traces.md) within Serverless
Console. All logs include a set of [Tags](product/tags.md) for searching and filtering
within the [Explorer](product/explorer.md) but are ingested and 
stored seperate from Traces and Metrics.

# Metrics
[Metrics](product/metrics.md) are numerical data about the 
performance of your applications or its underlying infrastructure.
These metrics are collected by the [Serverless Console Extension](platform/extension.md)
during an invocation but are ingested and store seperately from a Traces,
and Logs. For more details about Metrics see the [product/metrics.md] section.

# Traces
All the observability details about your apps and services are
captured as [Traces](products/traces.md). The Trace brings together
the Metrics, Tags, and Spans associated to an event within your system.
Traces can be used to identify slowness, pinpoint errors, and understand
the interaction between different systems. 

There are several durations asscociated with a single Trace
which segemented as Initialization, Invocation and Shutdown. Not
all of these affect the end-user experience or your bill.

A more detailed description of what is incldued for each duration is included
in our [duration guide](product/duration.md).

# Tags
All Traces, Logs and Metrics share a specific set of [Semantic Tags](tags.md)
added by our [Serverless Console Extension](platform/extension.md). These tags are used
for filtering and navigating within Serverless Console.

# Scopes
A [Scope](product/scopes.md) is a set of tags used to identify patterns as use-cases that
are handled by Serverless Console. All metrics, logs, and traces must
match a recognized scope to be ingested into Serverless Console.

# Serverless Console Extension
The [Serverless Console Extension](platform/extension.md) is a AWS Lambda extension
for collecting logs, metrics, and trace data from your AWS Lambda functions. 

# Organization
An organization is a unique tenant within the Serverless suite of 
products (including Serverless Dashboard, Serverless Cloud, and 
Serverless Console). 

# AWS Lambda
The following are AWS specific terms which are helpful in understanding how 
Serevrless Console applies specific AWS Lambda Functionality.

## Handler
The handler of an AWS Lambda function is where your business logic resides.
Fore more details about what duration accounted for in the Handler see the
[duration guide](product/duration.md#extensions-and-the-invocation-phase)

## Initialization
The initilization phase of a Trace includes any setup time associated
with the event. This will include one time occurences like an
[AWS Cold-Start](#cold-start), as well as initatlizing runtime requirements. 
Poor Initialization performance will directly affect the experience of your 
users and customers as well as affect cost.

More details about optimizing initialization performance are in the 
[Duration Guide](product/duration.md#optimizing-initlization-in-aws).

## Invocation 
An invocation referes to the execution of a function in a Serverless
FAAS such as AWS Lambda. This only includes the specific execution
of your bussines logic and code you control directly. Because it does
not include all of the initlization time, it does not represent the
duration end users experience, or used to calculate cost. 

## Shutdown
Most FAAS platforms utilize some sort of shutdown process that can
impact [Initilization](#initialization) behavior and timeouts. These
details are not collected or represented in Serverless Console and
does not usually affect cost or end user experience directly.

## Cold-Start
When an AWS Lambda function recieves a request, and it has not been used before, or for several minutes, its environment and code must first be Initialized.  This process is known as an AWS Lambda Cold-Start.  This process adds latency to the overall invocation duration.

After the execution completes, the execution environment is frozen. To improve resource management and performance, the Lambda service retains the execution environment for a non-deterministic period of time. During this time, if another request arrives for the same function, the service may reuse the environment. This second request typically finishes more quickly, since the execution environment already exists and it’s not necessary to download the code and run the initialization code. This is called a Warm-Start.

According to an analysis of production Lambda workloads, cold starts typically occur in under 1% of invocations. The duration of a cold start varies from under 100 ms to over 1 second.

## Warm-Start
When an AWS Lambda function instance receives a request after having received previous requests within the last few minutes.  The Initialization phase does not happen and this is known as a Warm-Start.

## Timeout
A timeout is a [configurable limit for the duration of your AWS Lambda](product/duration.md#configuring-timeouts-in-aws-lambda).

<!--
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

-->

