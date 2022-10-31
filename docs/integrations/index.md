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
you will be automatically be asked to add the AWS Account. Starting this process will start [syncing your resource](#synching-inventory) and will kick off the following in your AWS Account:

1. Creation of [a set of IAM Roles](data-sources-and-roles.md#serverless-iam-roles) using CloudFormation. These roles are used to create additional infrastructure needed in your account. 

1. Creation of an [EventBridge](./glossary.md#EventBridge) event bus and [CloudTrial](../glossary.md#cloudtrail) event trail for handling Lambda deploy events. This is used to keep your [resource inventory in synch](#synching-inventory) and [enable specific monitoring features](./enable-monitoring-features.md). 

1. Creation of a [CloudWatch Metric Stream](../glossary.md#cloudwatch-metric-stream) for collection metrics across all your [Resources](../glossary.md#resources).

1. Creation of two [Kinesis Firehose](../glossary.md#kinesis-firehose) for sending logs and metrics to Serverless Consoles.

These steps may take a few minutes depending on the complexity of your account. 

Note: this same process can be initiated from the CLI using [Serverless Framework](#onboarding-using-serverless-framework)

### Integration Status
Once you have initiated the creation CloudFormation stack the process will take a few moments
and the status of your integration will be one of the following.

**Pending** - A pending integration is still setting up initial infrastructure
in your AWS account.

**Running** - This running integration has setup the initial infrastructure, but is 
currently synching inventory across your account. In addition to synching resources
when you are adding your AWS Account, the integration may appear as running due
to periodic synching processes that occur.

**Complete** - A complete integration has all infrastructure in place and 
inventory is up to date.  

**Incomplete** - An incomplete integration is missing infrastructure and may or may
not have accurate inventory information. You will need to delete this integration
or contact support.

#### Environment and Namespace Tags
During the initial synch we traverse all Lambda functions and CloudFormation stacks to help determine
a helpful Environment, and Namespace. Environment is determined by the Lambda Environment variable `STAGE` and is used to represent a collection of apps that correspond to a specific environment for your application like `development` or `production`. Namespaces allow you to group Lambda functions together. This can be useful for tracking Lambda functions associated with a common business outcome (e.g. a shopping-cart). These are determined from the "service" name specified in CloudFormation stacks.

After this one time process has run, we store these values locally and allow you to change them locally. Note, this does mean these values could potentially get out of synch if you change them later in your Environment Variable, or CloudFormation Stack. 


## Onboarding using the Serverless Framework
In addition to onboarding using [console.serverless.com](https://console.serverless.com?ref_website=https%3A%2F%2Fwww.serverless.com%2Fconsole%2Fdocs%2F) in your browser you can easily onboard
from the [Serverless Framework](https://github.com/serverless/serverless). 

Upgrade to version 3.24.0+

```text
npm install -g serverless

```
And run our onboarding command to walk through the same process above from the command line.

```text
serverless --console 
```

