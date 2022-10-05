<!--
title: Removing your AWS Account
menuText: Removing your AWS Account
description: Removing the AWS Observability Integration
menuOrder: 6
-->

# Removing your AWS Account
It is best to use the Console UI to remove any AWS Accounts you have setup. This automates the process of all associated infrastructure in your account. This includes the [CloudFormation Stack](../glossary.md#cloudformation-stack), [IAM Role](../glossary.md#iam-roles), [Metric Streams](../glossary.md#cloudwatch-metric-stream)and any [Lambda Layers](./glossary.md#lambda-layer) and [Cloudwatch Log Subscription Filters](../glossary.md#cloudwatch-subscriptions). 

### Removing the AWS Observability Integration manually.
It is possible this process the removal process could fail, and you will need to remove individual resources manually. The following provides helpful links and names for deleting the appropriate infrastructure. 

1. Remove the IAM Roles - Go to your [IAM Roles in AWS Console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/roles) and delete the role `ServerlessRole`.

1. Remove the CloudFormation Stack - Go to your [CloudFormation in AWS Console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringStatus=active&filteringText=&viewNested=true&hideStacks=false). Look for the stack named `Serverless-Inc-Role-Stack` and delete it. 

1. Remove the Kinesis Firehose - Go to [Kinesis Data Streams Page in AWS Console](https://us-east-1.console.aws.amazon.com/firehose/home?region=us-east-1#/streams) and delete the delivery streams named `serverless_logs-firehose` and `serverless_metrics-firehose`.

1. Remove the Cloudwatch Metric Streams - Go to [Cloudwatch Metric Streams Page in AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metric-streams:streamsList) and delete the metric stream name `serverless_metrics-stream`.

1. Remove the Cloudwatch Log Subscriptions - Go the your [Cloudwatch Logs Group Page in the AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups). For each function you have enabled log collection on open the corresponding Log Group (the function name will appear in the Log Group path). Under the Log Group click on the 'Subscription Filters' tab and remove the delete the filter name `serverless_logs-filter`.

1. Remove the Extension, SDK and Env Vars - Go to your [Lamdba page in AWS Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions). For each function you have enabled Tracing or Dev Mode on click on the function. Go to the Layers section of the function and delete the layers with `sls-sdk-node` and `sls-external-extension`. Under Configuration -> Environment Variables remove the environment variables `AWS_LAMBDA_EXEC_WRAPPER`, `SLS_DEV_MODE_ORG_ID` and `SLS_ORG_ID`.

### Removing the legacy console extension
If you have deployed to a version of Serverless Console prior to October 2022 then you may need to remove a legacy extension manually. To do this remove any layers named `sls-otel-extension-node-v*` and remove the environment variable `SLS_EXTENSION`.

