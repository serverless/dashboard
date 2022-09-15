<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 5
-->

# FAQ


## Adding the AWS Observability Integration

**What access do I need to add an AWS Account?**

**What infrastructure is getting setup in my AWS Account?**

**How do I delete infrastructure setup by Serverless Console?**

**What availability zones is Serverless Console hosted in?**

**What costs might result from not being hosted in us-east-1?**

## Configuring apps and services

**How do I start using Serverless Console with my app?**

**What does enabling dev-mode do?**

**How long before a log or metric will show up in Serverless Console?**

**What Serverless.yaml fields effect console?**

## Metrics and Use Cases


**What languages and runtimes are supported?**

Currently Serverless Console only supports Node.js on AWS Lambda.

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
 


## Data Retention

**What data is stored by Serverless Console and for how long?**

We store all trace data including request and response payloads
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
