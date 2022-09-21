<!--
title: Sending Data to Console 
menuText: Instrumentation
description: Compatible Serverless Console Platform
menuOrder: 3
-->

# Sending Data to Console
Serverless Console collects data by integrating with your AWS Account.
Integrating your account will give Serverless Console access to logs
and metrics from Cloudwatch and in some cases add an integration layer
to your Lambda functions. 

This documentation gives you a reference for understanding how our instrumentation 
works and details about what is collected.

## Adding the AWS Observability Integration
Once you have [created your organization](../product/create-org.md) you need to 
add an AWS Observability Integration to your org. The AWS Observability Integration
is the foundation for all the data we collect about your apps and services. Adding
the AWS Observability integration will create a new [IAM Role](#serverless-iam-role) in your account. We use this to take inventory of your account, and give you control for what's collected.

If you have multiple AWS accounts, you can add more than one AWS Integration
to your org. This will give you the ability to explore across all your
applications. You are limited to adding each AWS Account to one org only.

### Synching Inventory
Once you have an AWS Observability Integration setup, the collection of [logs and
traces](./enabling-logs-traces.md) is based around the set of inventory of Lambda Functions in your AWS account. Synching is handling automatically on a 24 hour basis, or can be triggered
manually to add new recently deployed functions. Metrics for all your functions are collected automatically as they are deployed.

### Enabling per Function Monitoring Features
Once you have added your Integration, you are set to unlock the full potential of Serverless Console for your individual functions. To [enable logs, traces, and dev-mode](./enabling-logs-traces.md) go to Settings -> Integrations and Edit to access per function configuration.


## Removing the AWS Observability Integration
It is best to use the Console UI to remove any AWS Accounts you have setup. This automates the process of all associated instrastructure in your account. This includes the [CloudFormation Stack](../glossary.md#cloudformation-stack), [IAM Role](../glossary.md#iam-roles), [Metric Streams](../glossary.md#cloudwatch-metric-stream)and any [Lambda Layers](./glossary.md#lambda-layer) and [Cloudwatch Log Subscription Filters](../glossary.md#cloudwatch-subscriptions). 

### Removing the AWS Observability Integration manually.
It is possible this process the removal process could fail, and you will need to remove individual resources manually. The following provides helpful links and names for deleting the apropriate infrastructure. 

1. Remove the CloudFormation Stack - Go to your [CloudFormation in AWS Console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringStatus=active&filteringText=&viewNested=true&hideStacks=false). Look for the stack named `Serverless-Inc-Role-Stack` and delete it. 
1. Remove the Kinesis Firehose - Go to [Kinesis Data Streams Page in AWS Console](https://us-east-1.console.aws.amazon.com/firehose/home?region=us-east-1#/streams) and delete the delivery streams named `serverless_logs-firehose` and `serverless_metrics-firehose`.
1. Remove the Cloudwatch Metric Streams - Go to [Cloudwatch Metric Streams Page in AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metric-streams:streamsList) and delete the metric stream name `name-needed`.
1. Remove the Cloudwatch Log Subscriptions - Go the your [Cloudwatch Logs Group Page in the AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups). For each function you have enabled log collection on open the corresponding Log Group (the function name will appear in the Log Group path). Under the Log Group click on the 'Subscription Filters' tab and remove the delete the filter name `name-needed`.
1. Remove the Extension and SDK - Go to your [Lamdba page in AWS Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions). For each function you have enabled Tracing or Dev Mode on click on the function. Go to the Layers section of the function and delete the layers with `sls-sdk-node` and `name-needed`. 

