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
[enable monitoring features](./enable-monitoring-features.md) for those resources. An EventBridge rule is setup in each region you have Active Resources in. 

## Metric Streams
Serverless Console collects metrics for all your Lambda functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). 

Currently metric streams are limited to collect metrics from Lambda, and API Gateway. While we only display a [subset of metrics](../product/metrics.md) [this guide offers complete list of Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html) we collect. A unique metric stream and [Kinesis Firehose](../glossary.md#kinesis-firehose) is created in each region you have [Active Resources](../glossary.md#active-resource) in. 

## CloudWatch Log Subscriptions
When you enable logging for a functions we setup a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html) to collect logs
for that function. Cloudwatch Subscriptions are configured in the region your function is deployed to. 

## Extensions
Serverless Console leverages multiple [Lambda Extensions](../glossary.md#serverless-extension) for instrumenting Lambda Functions. These are used to collect [details about specific interactions](./enable-monitoring-features.md#enabling-traces) as well as [stream logs](./enable-monitoring-features.md#enabling-dev-mode).

## Serverless Node SDK
The Serverless Node SDK can be added to your Lambda Function to [collect Traces](./enable-monitoring-features.md#enabling-traces) about the initialization, and invocation of your Lambda function. This gives you additional insight into the processing of your function and related services. This extension is added when you [enable Tracing](./enable-monitoring-features.md#enabling-traces) in your function. 

In addition to collecting Trace data, the SDK will capture [real time invocation events](../product/dev-mode.md#real-time-invocation-events) including request and response headers. This data is only used by the dev-mode feature and is not stored in Serverless Console. To opt out of collecting this data you can set the ENV VAR <details-needed> on your function. 

Currently this is limited to Node.js 14+ runtime only. 

To capture this information some additional details are added to the logs. These are filtered
from display within Serverless Console but will appear in your logs when viewed in other tools
and will look like.

```text
SERVERLESS_TELEMETRY.T.ClsKJDc5NmUwMDY2LTZiNjQtNDk2NC1iODJlLTgzYmQxYWQzMjVhNhoOZnJhc2VyLWRldi1hcGkqIwoaQHNlcnZlcmxlc3MvYXdzLWxhbWJkYS1zZGsSBTAuOC4xGoIFCiAwNjg2ZWRjMmE3YzE2YjdkNzM1NDA2MzcwYTMyZGFhMRIgNDg2MTU3OTY5YTQ1ZDdkMTEyMDg4ZmUzYzNjN2IwNTQiCmF3cy5sYW1iZGEpvTXmcFgWHRcx98uHflgWHRc6nQSiBpkEogaVBAoGeDg2XzY0EAEaGGF3cy5hcGlnYXRld2F5djIuaHR0cC52MiIOYXdzLmFwaWdhdGV3YXlCDmZyYXNlci1kZXYtYXBpSiQ2M2M2ZDhiNC03N2UwLTQ1OWItODk0ZC0wNzU1Y2U2YTlkOGZaByRMQVRFU1RwAbIGzQIKA0dFVBIISFRUUC8xLjEaLm45Z2VyYTNsdWguZXhlY3V0ZS1hcGkudXMtZWFzdC0xLmFtYXpvbmF3cy5jb20iDC9mYXZpY29uLmljb0IGYWNjZXB0Qg9hY2NlcHQtZW5jb2RpbmdCD2FjY2VwdC1sYW5ndWFnZUIOY29udGVudC1sZW5ndGhCBGhvc3RCB3JlZmVyZXJCCXNlYy1jaC11YUIQc2VjLWNoLXVhLW1vYmlsZUISc2VjLWNoLXVhLXBsYXRmb3JtQg5zZWMtZmV0Y2gtZGVzdEIOc2VjLWZldGNoLW1vZGVCDnNlYy1mZXRjaC1zaXRlQgp1c2VyLWFnZW50Qg94LWFtem4tdHJhY2UtaWRCD3gtZm9yd2FyZGVkLWZvckIQeC1mb3J3YXJkZWQtcG9ydEIReC1mb3J3YXJkZWQtcHJvdG9IlAO6Bj8KDDk1NDQzNjAzNzk2MhIKbjlnZXJhM2x1aBoIJGRlZmF1bHR6GQoQWjJqSzdndTNJQU1FTWFnPRDcwIHCvDDSBgoKCCRkZWZhdWx0GpUBCiBjZGFhZmE4MWI5ZDhhMzI4YzI2MzNiN2RhOTYwMzJlMhIgNDg2MTU3OTY5YTQ1ZDdkMTEyMDg4ZmUzYzNjN2IwNTQaIDA2ODZlZGMyYTdjMTZiN2Q3MzU0MDYzNzBhMzJkYWExIhlhd3MubGFtYmRhLmluaXRpYWxpemF0aW9uKb015nBYFh0XMd00tXxYFh0XOgAakQEKIGNiYjYxYmMyYjA5YjZlZDI4ZGUwNTRkYmVmZWRmYTFiEiA0ODYxNTc5NjlhNDVkN2QxMTIwODhmZTNjM2M3YjA1NBogMDY4NmVkYzJhN2MxNmI3ZDczNTQwNjM3MGEzMmRhYTEiFWF3cy5sYW1iZGEuaW52b2NhdGV+WBYdFzoAGpoBCiBlNjJmOThjMWM2NWQ2NTkyMDIxMmU2MzQ4Y2I3ZWNiOBIgNDg2MTU3OTY5YTQ1ZDdkMTEyMDg4ZmUzYzNjN2IwNTQaIDQ0MDM1NzQ2MjdiZTg5OWMzOWYzZGNmZTBkNDQ4NzhhIh5leHByZXNzLm1pZGRsZXdhcmUuZXhwcmVzc2luaXQp7r0nflgWHRcxMS8qflgWHRc6ABqYAQogZGEzYTg0MjgwODIzOTMxYzk3YzE5MjEwOTkyMzFkYWUSIDQ4NjE1Nzk2OWE0NWQ3ZDExMjA4OGZlM2MzYzdiMDU0GiA0NDAzNTc0NjI3YmU4OTljMzlmM2RjZmUwZDQ0ODc4YSIcZXhwcmVzcy5taWRkbGV3YXJlLmFub255bW91cynCXit+WBYdFzFd42t+WBYdFzoAlvbimt/N19WBYdFzH3y4d+WBYdFzoAGoMBCiA0NDAzNTc0NjI3YmU4OTljMzlmM2RjZmUwZDQ0ODc4YRIgNDg2MTU3OTY5YTQ1ZDdkMTEyMDg4ZmUzYzNjN2IwNTQaIGNiYjYxYmMyYjA5YjZlZDI4ZGUwNTRkYmVmZWRmYTFiIgdleHByZXNzKTA4Hn5YFh0XMV3ja35YFh0XOgAalAEKIGUzNjVlOGU3MWI1ZGQzZWYzNjNkZDE4Yjk4YWZiM2E4EiA0ODYxNTc5NjlhNDVkN2QxMTIwODhmZTNjM2M3YjA1NBogNDQwMzU3NDYyN2JlODk5YzM5ZjNkY2ZlMGQ0NDg3OGEiGGV4cHJlc3MubWlkZGxld2FyZS5xdWVyeSnFjiB+WBYdFzGfyS
```

Disabling tracing will remove these statements from your logs. 

### Supported Child Spans
Currently we support the colection of the following interactions along with tags for each. 

* express.js
* dynamoDB
* SQS
* SNS


## External Extension
The Serverless External Extension is a runtime agnostic extension that [streams logs and events](./enable-monitoring-features.md#enabling-dev-mode) to Serverless Console. 


### Updating Extensions
When you enable Tracing for a function the latest version of the Lambda Layer will automatically
be added to your function. If you need to update a the version for a function you have already enabled you will need to disable, and re-enable the function.     