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
Serverless Console collects metrics for all your Lamdba functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). This allows
you to monitor functions as you deploy them, and [synch inventory](./index.md#inventory-synching) when new functions are deployed.

## Cloudwatch Log Subscriptions
When you enable logging for a functions we setup a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to collect logs
for that function. These logs are collected in us-east-1. Sending logs to other availability zones may result in higher bandwidth costs. 

## Lambda Layer
When you enable tracing an additional layer is added to your Lambda function. This layer is 
used to include additional information about your [Trace](../product/traces.md). Including this layer
will add some additional processing time to your Lambda Function and is recommended for functions
where you want to include Trace details for debugging purposes or for use in the Trace Explorer.

### Updating to use the latest Lambda Layer
When you enable tracing for a function the latest version of the Lambda Layer will automatically
be added to your function. If you need to update a the version for a function you have already enabled you will need to disable, and re-enable the function. 