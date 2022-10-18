<!--
title: Integrations
menuText: Integrations
description: Adding the AWS Integration
menuOrder: 3
-->

# Integrations
Serverless Console uses an event driven approach to integrate with 
third-party cloud services commonly used in Serverless Architectures. 

This documentation gives you a reference for understanding how our Integration 
process works and [what data is collected](./data-sources-and-roles.md) by Serverless Console. 

## Adding your AWS Account
Once you have [created an organization](../product/create-org.md) in Serverless Console
you will be automatically be asked to add the AWS Account. Starting this process will start [syncing your resource](#synching-inventory) and will kick off the following in your AWS Account.

1. Creation of [a set of IAM Roles](data-sources-and-roles.md#serverless-iam-roles) using CloudFormation. These roles are used to create additional infrastructure needed in your account. 

1. Creation of an [EventBridge](./glossary.md#EventBridge) event bus and [CloudTrial](../glossary.md#cloudtrail) event trail for handling Lambda deploy events. This is used to keep your [resource inventory in synch](#synching-inventory) and [enable specific monitoring features](./enable-monitoring-features.md). 

1. Creation of a [CloudWatch Metric Stream](../glossary.md#cloudwatch-metric-stream) for collection metrics across all your [Resources](../glossary.md#resources).

1. Creation of two [Kinesis Firehose](../glossary.md#kinesis-firehose) for sending logs and metrics to Serverless Consoles.

These steps may take a few minutes depending on the complexity of your account. 

Note: this same process can be initiated from the CLI using [Serverless Framework](#onboarding-using-serverless-framework)

### Synching Inventory
Setting up the AWS Integration automatically sets up a synch process to ensure that
the latest resources are available in your account. This process will regularly check your CloudFormation stacks and Lambda functions in your account. 

This process will not apply specific [features you enable](./enable-monitoring-features.md) but instead reflect what features are applied in your AWS account. This will prevent any race conditions from occurring where we would attempt to add back an Lambda extension, or CloudWatch Log Subscription.

In addition to a regular synching process when a new Lambda function is deployed, we synch your changes and automatically apply an instrumentation settings you have. This means you will not have to re-enable features when you deploy an update to a function you are already monitoring.

#### Environment and Namespace Tags
During the initial synch we traverse all Lambda functions and CloudFormation stacks to help determine
a helpful Environment, and Namespace. Environment is determined by the Lambda Environment variable `STAGE` and is used to represent a collection of apps that correspond to a specific environment for your application like `development` or `production`. Namespaces allow you to group Lambda functions together. This can be useful for tracking Lambda functions associated with a common business outcome (e.g. a shopping-cart). These are determined from the "service" name specified in CloudFormation stacks.

After this one time process has run, we store these values locally and allow you to change them locally. Note, this does mean these values could potentially get out of synch if you change them later in your Environment Variable, or CloudFormation Stack. 


## Onboarding using the Serverless Framework
In addition to onboarding using [console.serverless.com]() in your browser you can easily onboard
from the [Serverless Framework](https://github.com/serverless/serverless). 

Upgrade to version 3.24.0+

```text
npm install -g serverless

```
And run our onboarding command to walk through the same process above from the command line.

```text
serverless --console 
```

