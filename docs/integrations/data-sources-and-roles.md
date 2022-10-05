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
[enable monitoring features](./enable-monitoring-features.md) for those resources. 

## Metric Streams
Serverless Console collects metrics for all your Lambda functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). 


### Lambda Metric Collection
Currently metric streams are limited to collect metrics from Lambda, and API Gateway. While we only display a [subset of metrics](../product/metrics.md) [this guide offers complete list of Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html) we collect.

## CloudWatch Log Subscriptions
When you enable logging for a functions we setup a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to collect logs
for that function. These logs are collected in us-east-1. Sending logs to other availability zones may result in higher bandwidth costs. 

## Extensions
Serverless Console leverages multiple [Lambda Extensions](../glossary.md#serverless-extension) for instrumenting Lambda Functions. These are used to collect [details about specific interactions](./enable-monitoring-features.md#enabling-traces) as well as [stream logs](./enable-monitoring-features.md#enabling-dev-mode).

## Serverless Node SDK (Internal Extension)
The Serverless Node SDK can be added to your Lambda Function to [collect Traces](./enable-monitoring-features.md#enabling-traces). 

## External Extension
The Serverless External Extension is a runtime agnostic extension that stream logs](./enable-monitoring-features.md#enabling-dev-mode) to Serverless Console. 

### Updating Extensions
When you enable tracing for a function the latest version of the Lambda Layer will automatically
be added to your function. If you need to update a the version for a function you have already enabled you will need to disable, and re-enable the function.     