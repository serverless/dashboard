<!--
title: Metrics
menuText: Metrics
description: A guide to using our metric views and create your own.
menuOrder: 6
-->

# Metrics 
Metrics are automatically collected across your AWS Account
when you [add an AWS Observability Integration](../instrumentation/index.md#adding-the-aws-observability-integration). These metrics are collected
using [Cloudwatch Metric Streams](../instrumentation/data-sources.md#metric-streams)
which allow us to collect metrics from a variety of AWS Services in aggregate.

## Metric Aggregation
Metrics for services are aggregated over an interval which helps to compress
the amount of data required for storage, and make it more practical to 
chart and alert on them. It also means we don't have individual data points for
for a given Trace, but rather only collect the average, and certain percentiles.

## Lambda Metric Collection

https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html

Lambda metrics are collected for all functions for in your AWS Account(s). This
allows you to use metrics to discover new services that are active in your account
and configure any additional troubleshooting that is helpful. 

**Lambda Invocation**
Use for monitoring the overal usage of Lambda functions metrics are collected
about each Lambda execution. These are aggregated per minute.

**Lambda Error** 
To further classify function execution events, a summary of error events is collected
across all your functions ech minute .

**Lambda Compute Duration** - This metric is used for collecting details about the
total time it took for a given Trace. For more details about duration, see our 
[guide to understanding Lambda duration](./duration.md).

## Other Planned Metric Ingestion
While currently, the metric ingestion is limited to Lambda related metrics, the
[AWS Observability Integration](../instrumentation/index.md#adding-the-aws-observability-integration) provides access to metrics from
other services like DynamoDB, SQS, SNS and API Gateway. 

## Filters
Applying filters to the metrics view allows you to narrow in on 
specific functions, or use cases that are of interest to you. Filters can be saved
as a shared views to collaborate with team mates on specific searches. 

- **Function Names** You can filter metrics for a specific function based on the
name used in your AWS Lambda function.

- **Namespace** Namespaces allow you to group Lambda functions together. This can be useful
for tracking Lambda functions associated with a common business outcome (e.g. a shopping-cart).

- **Environment** Environment is another way to group sets of functions for filtering. These are used to associate apps across an entire environment such as staging, or production. 

More details about configuring your Namespace and Environment tag can be found in our [Enabling Additional Monitoring Features Section](../instrumentation/enabling-logs-traces.md#setting-environment-and-namespace-tags)

- **Region** - Region is the specific region your Lambda function is executing in. 

- **Cloud Account** - Cloud Account will show the account number or nickname for an [AWS Observability Integrations you have added](../instrumentation/index.md#adding-the-aws-observability-integration).



