<!--
title: Serverless Console Data Sources
menuText:   Serverless Console Data Sources
description:  Serverless Console Data Sources
menuOrder: 5
-->

#   Serverless Console Data Sources
Once you have inventory from your [AWS Observability Integration synched](./index.md#inventory-synching) you will have the option to enable 
logs and traces on each of your functions. 

## Metric Streams
Serverless Console collects metrics for all your Lambda functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). This allows
you to monitor functions as you deploy them, and [synch inventory](./index.md#inventory-synching) when new functions are deployed.

### Lambda Metric Collection
Currently metric streams are limited to collect metrics from Lambda, and API Gateway. While we only display a [subset of metrics](../product/metrics.md) [this guide offers complete list of Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html) we collect.

## Cloudwatch Log Subscriptions
When you enable logging for a functions we setup a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to collect logs
for that function. These logs are collected in us-east-1. Sending logs to other availability zones may result in higher bandwidth costs. 

## Extensions
Serverless Console leverages multiple [Lambda Extensions](../glossary.md#serverless-extension) for instrumenting Lambda Functions. These are used to collect [details about specific interactions](./enabling-logs-traces.md#enabling-traces) as well as [stream logs](./enabling-logs-traces.md#enabling-dev-mode).

## Serverless Node SDK (Internal Extension)
The Serverless Node SDK can be added to your Lambda Function to [collect Traces](./enabling-logs-traces.md#enabling-traces). 

## External Extension
The Serverless External Extension is a runtime agnostic extension that stream logs](./enabling-logs-traces.md#enabling-dev-mode) to Serverless Console. 


### Updating Extensions
When you enable tracing for a function the latest version of the Lambda Layer will automatically
be added to your function. If you need to update a the version for a function you have already enabled you will need to disable, and re-enable the function.     