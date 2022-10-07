<!--
title: Serverless Console Data Sources
menuText:   Serverless Console Data Sources
description:  Serverless Console Data Sources
menuOrder: 5
-->

#   Serverless Console Data Sources and Permissions
This documentation provides an overview of the roles configured, and data collected
by Serverless Console. 

## IAM Roles
We configure three IAM Roles when adding your AWS Account. Where possible, we try to 
use the least privilege possible, and keep [detailed comments](../../instrumentation/aws/iam-role-cfn-template.yaml) about the permissions we need.

* `ServerlessRole` - This is the primary role we use for the setting up general infrastructure
*  `ServerlessEventSubscriptionExecutionRole` - This role is used to configure [EventBridge](../glossary.md#EventBridge) for processing new [CloudTrail](../glossary.md#cloudtrail) events.
* `ServerlessMonitoringRole` - This is the role used to create required [Kinesis Firehose instances](../glossary.md#kinesis-firehose) and [CloudWatch Metric Stream](../glossary.md#cloudwatch-metric-stream).

## CloudTrail Events
We use [EventBridge] as a data source for determining creation of resources and when appropriate
[enable monitoring features](./enable-monitoring-features.md) for those resources. An EventBridge rule is setup in each zone you have Active Resources in. 

## Metric Streams
Serverless Console collects metrics for all your Lambda functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). 

Currently metric streams are limited to collect metrics from Lambda, and API Gateway. While we only display a [subset of metrics](../product/metrics.md) [this guide offers complete list of Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html) we collect. A unique metric stream and [Kinesis Firehose](../glossary.md#kinesis-firehose) is created in each zone you have [Active Resources](../glossary.md#active-resource) in. 

## CloudWatch Log Subscriptions
When you enable logging for a functions we setup a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to collect logs
for that function. Cloudwatch Subscriptions are configured in the zone your function is deployed to. 

## Extensions
Serverless Console leverages multiple [Lambda Extensions](../glossary.md#serverless-extension) for instrumenting Lambda Functions. These are used to collect [details about specific interactions](./enable-monitoring-features.md#enabling-traces) as well as [stream logs](./enable-monitoring-features.md#enabling-dev-mode).

## Serverless Node SDK (Internal Extension)
The Serverless Node SDK can be added to your Lambda Function to [collect Traces](./enable-monitoring-features.md#enabling-traces) about the initialization, and invocation of your Lambda function. This gives you additional insight into the processing of your function and related services. This extension is added when you [enable Tracing](./enable-monitoring-features.md#enabling-traces) in your function. 

In addition to collecting Trace data, the SDK will capture [real time invocation events](../product/logs.md#real-time-invocation-events) including request and response headers. This data is only used by the dev-mode feature and is not stored in Serverless Console. To opt out of collecting this data you can set the ENV VAR <details-needed> on your function. 

Currently this is limited to Node.js 14+ runtime only. 


## External Extension
The Serverless External Extension is a runtime agnostic extension that [streams logs and events](./enable-monitoring-features.md#enabling-dev-mode) to Serverless Console. 


### Updating Extensions
When you enable Tracing for a function the latest version of the Lambda Layer will automatically
be added to your function. If you need to update a the version for a function you have already enabled you will need to disable, and re-enable the function.     