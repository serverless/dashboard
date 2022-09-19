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


### Serverless IAM Role
The [ServerlessMonitoringRole](../../instrumentation/aws/iam-role-cfn-template.yaml) provides 
the necessary access for monitoring your apps and services. We designed this template with 
the following goals.

* **Limited write access to very limited** there are a few limited services where we need
to set things up in your AWS Account. This includes Cloudwatch, Lambda, S3 and API Gateway. 
* **Well Documented Read Access** we realize Serverless architectures often rely on stateful
services. We have (clearly documented and defined our read access permissions](../../instrumentation/aws/iam-role-cfn-template.yaml) for each service.

## Removing the AWS Observability Integration
Removing the AWS Observability using Console will remove all associated resources with Serverless Console. This includes the [CloudFormation Stack](../glossary.md#cloudformation-stack), [IAM Role](../glossary.md#iam-roles), [Metric Streams](../glossary.md#cloudwatch-metric-stream)and any [Lambda Layers](./glossary.md#lambda-layer) and [Cloudwatch Log Subscription Filters](../glossary.md#cloudwatch-subscriptions) that may have been setup. 