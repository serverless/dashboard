<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 5
-->

# FAQ

## Adding the AWS Observability Integration

**What access do I need to add an AWS Account?**
You will need to admin access to setup the AWS Account. Adding the Integration adds a CloudFormation stack that configures an IAM Role that then creates additional resources. More details are available in the [adding the AWS Observability guide](../integrations/index.md)

**What infrastructure is getting setup in my AWS Account?**
When you add the AWS Observability the following components get setup.

* [CloudFormation Stack](./glossary.md#cloudformation-stack)
* [IAM Role](./glossary.md#iam-roles)
* [Metric Streams](./glossary.md#cloudwatch-metric-stream)

After you have added the AWS Observability integration, [enabling additional monitoring features](./integrations/enable-monitoring-features.md) will also create.

* [Lambda Layers](./glossary.md#lambda-layer)
* [Cloudwatch Log Subscription Filters](./glossary.md#cloudwatch-subscriptions)

**How do I delete infrastructure setup by Serverless Console?**
The best way to delete the infrastructure provisioned by Serverless Console is to Remove the integration using the Console UI. This will remove all the infrastructure associated with Serverless Console. 

If you wish to disable function specific [Lambda Layers](./glossary.md#lambda-layer) or [Cloudwatch Log Subscription Filters](./glossary.md#cloudwatch-subscriptions) you can [disable function specific monitoring features](./integrations/enable-monitoring-features.md) on the integrations page.


**What availability zones is Serverless Console hosted in?**
You can use Serverless Console regardless of what region or zone your Lambda function is in. That said, Serverless Console is hosted exclusively in us-east-1. Contact [sales@serverlss.com](mailto:sales@serverless.com) about additional zone requirements.

**What costs might result from not being hosted in us-east-1?**
If your Lambda function is not in us-east-1 you may experience additional bandwith costs for sending data to Serverless Console. 

## Configuring apps and services

**How do I start using Serverless Console with my app?**
Metrics for your Lambda function will automatically show up in Serverless Console once you deploy. You can [enable additional monitoring features](./integrations/enable-monitoring-features.md) to start capturing, logs, traces and using dev mode. 

**What does enabling dev-mode do?**
Enabling dev-mode adds an [external extension](./integrations/enable-monitoring-features.md#enabling-dev-mode) to your Lambda function. This external function bypasses log collection in AWS Cloudwatch and sends the log directly to Serverless Console in under a second. 

**How long before a log or metric will show up in Serverless Console?**
For metrics, the first metric may take a few minutes to show up when attaching a new integration or deploying a new function. Subsequent metric details will arrive in seconds. Logs and Traces will take several seconds to reconcile, but enabling dev mode streams directly with little to no noticable latency.

**What Serverless.yaml fields effect console?**
[Serverless Framework](https://www.serverless.com/framework/docs) is one of the easiest ways to integrate with Serverless Console and allows you
to enable Logs, Traces, and Dev-Mode using Infrastructure as Code (IAC). See more details about using [Serverless Framework](./integrations/enable-monitoring-features.md#using-framework-to-enable-features).


## Metrics and Use Cases

**What languages and runtimes are supported?**
All runtimes are supported for Logs and Dev-Mode, but Tracing is only available for Node.js runtimes. 

**How can I use console to find API Errors?**

Trouble shooting and finding API errors is a valuable way to use Serverless
Console. To identify API Errors, select the HTTP status codes and filter for
500 or other status codes you are interested in visualizing. We recommend 
[saving a custom view](using/metrics.md)of your non 200 status code across 
in your production environments across your org. 

You can use this view to quickly identify anomalies, and then locate the
underlying [Trace](using/traces.md) that caused the problem.

**How can I use console to find slow API Endpoints?**

Slow API responses can negatively impact users and cost your organization money.
Our metrics and trace explorer allow you to filter on specific endpoints and
environment. From there the p95 metric shows you the worst 5% of API
performance, and the p90 metric shows you the worst 10%. Filtering the traces
for Durations higher than those metrics will lead you to your slowest requests. 


## Pricing and Costs

**How much does Serverless Console cost?**
It's free to start using Serverless Console. With our generous free tier you can start using Serverless Console without a credit-card. 

For details about our paid tiers see our [product pricing page](./product/pricing.md).

**What happens when my org has been shutoff?**
If you exceed the monthly quota for the Free Tier we will stop ingesting, logs, metrics and traces for your orginization. It will not [remove all infrastructure](./integrations/index.md#removing-the-aws-observability-integration) from your AWS account. 

## Data Retention

**What data is stored by Serverless Console and for how long?**

We store all trace data, event payloads, metrics
and logs in our systems for 30 days before being deleted.

**How can I disable log and event data collection?**
Log and event data can contain sensitive information. 
To disable log, and/or request response data collection 
set the following properties in your `serverless.yaml` file.

```yaml
org: myorg
console: 
    monitoring:
      logs:
        disable: true
      request:
        disable: true
      response:
        disable: true
service: myservice
frameworkVersion: '3'
```

**Can I request to have my data deleted?**
Yes, we can accommodate data deletion requests on an ad-hoc basis.
Please reach out to support@serverless.com if you wish to have your
console data removed.
