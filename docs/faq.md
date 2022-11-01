<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 5
-->

# FAQ

## Adding the AWS  Integration

**What access do I need to add an AWS Account?**
You will need to admin access to setup the AWS Account. Adding the Integration adds a CloudFormation stack that configures an IAM Role that then creates additional resources. More details are available in the [adding the AWS Integration guide](../integrations/index.md)

**What infrastructure is getting setup in my AWS Account?**
When you add the AWS Integration the following components get setup.

* [CloudFormation Stack](./glossary.md#cloudformation-stack)
* [IAM Role](./glossary.md#iam-roles)
* [Metric Streams](./glossary.md#cloudwatch-metric-stream)
* [EventBridge rules](./glossary.md#eventbridge)
* [CloudTrail trail](./glossary.md#cloudtrail)

After you have added the AWS Observability integration, [enabling additional monitoring features](./integrations/enable-monitoring-features.md) will also create.

* [Lambda Layers](./glossary.md#lambda-layer)
* [Cloudwatch Log Subscription Filters](./glossary.md#cloudwatch-subscriptions)

**How do I delete infrastructure setup by Serverless Console?**
The best way to delete the infrastructure provisioned by Serverless Console is to Remove the integration using the Console UI. This will remove all the infrastructure associated with Serverless Console. 

If you wish to disable function specific [Lambda Layers](./glossary.md#lambda-layer) or [Cloudwatch Log Subscription Filters](./glossary.md#cloudwatch-subscriptions) you can [disable function specific monitoring features](./integrations/enable-monitoring-features.md) on the integrations page.

If you do need to delete manually check our [guide for removing the AWS Integration](./integrations/removing-aws-integration.md)

**What Regions is Serverless Console hosted in?**
You can use Serverless Console regardless of what region or region your Lambda function is in. That said, Serverless Console is hosted exclusively in us-east-1. Contact [sales@serverlss.com](mailto:sales@serverless.com) about additional region requirements. 


## Configuring apps and services

**How do I start using Serverless Console with my app?**
Metrics for your Lambda function will automatically show up in Serverless Console once you deploy. You can [enable additional monitoring features](./integrations/enable-monitoring-features.md) to start capturing, logs, Traces and using dev mode. 

**What does enabling dev-mode do?**
Enabling dev-mode adds an [external extension](./integrations/enable-monitoring-features.md#enabling-dev-mode) to your Lambda function. This external function bypasses log collection in AWS Cloudwatch and sends the log directly to Serverless Console in under a second. 

**How long before a log or metric will show up in Serverless Console?**
For metrics, the first metric may take a few minutes to show up when attaching a new integration or deploying a new function. Subsequent metric details will arrive in seconds. Logs and Traces will take several seconds to reconcile, but enabling dev mode streams directly with little to no noticeable latency.

**What Serverless.yaml fields effect console?**
Serverless.yaml is no longer used to configure Serverless Console. See our [Getting Started Guide](./index.md) to set up your AWS Account integration.

**Note: the console property has been deprecated from serverless.yaml** 

## Metrics and Use Cases

**What languages and runtimes are supported?**
All runtimes are supported for Logs and Dev-Mode, but Tracing is only available for Node.js 14+ runtimes. 


## Pricing and Costs

**How much does Serverless Console cost?**
It's free to start using Serverless Console. With our generous free tier you can start using Serverless Console without a credit-card. 

For details about our paid tiers see our [product pricing page](http://serverless.com/console/pricing/).


**What additional AWS costs will be incurred adding the AWS Integration**
You will see additional AWS costs associated with adding the AWS Integration. Primarily this costs
is related to [Cloudwatch MetricStreams](glossary.md#cloudwatch-metric-stream). The impact to your
account will depend on the number of regions you are using, number of [active resources](./glossary.md#active-resource) and overall Lambda usage in your account. 


**What happens when my org has been shutoff?**
If you exceed the monthly quota for the Free Tier we will stop ingesting, logs, metrics and Traces for your organization. It will not [remove all infrastructure](./integrations/index.md#removing-the-aws-observability-integration) from your AWS account. 

## Data Retention

**What data is stored by Serverless Console and for how long?**
We store all Trace data, event payloads, metrics
and logs in our systems for 30 days before being deleted.

**Is request/response data stored by Serverless Console?**
No. While you can [enable request response data](./integrations/enable-monitoring-features.md#enabling-traces) collection this data is sent directly to the Dev Mode console and is not
stored in Serverless Console.

**How can I disable log and event data collection?**
You can do this by going to Integrations->Edit. See more details about [enabling monitoring features](./integrations/enable-monitoring-features.md)

**Can I request to have my data deleted?**
Yes, we can accommodate data deletion requests on an ad-hoc basis.
Please reach out to support@serverless.com if you wish to have your
console data removed.
