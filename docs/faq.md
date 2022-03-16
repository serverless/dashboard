<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 8
-->

# FAQ
**How do I start using Serverless Console with my app?**

The simplest way to get going with Serverless Console is to make sure your on
the latest version of Serverless Framework and add the console enabled property
to your `serverless.yaml` file.

```yaml
org: myorg
console: true
service: myservice
frameworkVersion: '3'
```

**Note:** The following example will disable the use of Serverless Dashboard. 

**What Serverless.yaml fields effect console?**

Several details of your serverless.yaml file will be relevant in Serverless
Console. This includes, your org (required), stage, service and function names.

```yaml

# Orginization name (required)
org: myorg

# Console flag (required true)
console: true

# Dashboard flag (optional - set if you are using serverless dashboard features)
dashboard: true

# Service name (required)
service: myservice

# Framework version 3.7.1 or higher
frameworkVersion: '3.7.1'

# Function names are provided as filters within COnsole	
functions:
  hello:

```

Additonally the stage parameter will be included as an environment filter within
Serverless Console.

```text
severless deploy --stage #included as environment
```

**How does Serverless Console relate to Serveless Dashboard?**

Serverless Console is a new stand alone product, but can leverage functionality
from Serverless Dashboard like parameters, providers and secrets. To take
advantage of these features be sure to set the dashboard flag in your
serverless.yaml.

```yaml
org: myorg
dashboard: true
console: true
service: myservice
frameworkVersion: '3'
```

Serverles Console also share your orginization and users from Serverless
Dashboard and/or Serverless Cloud. 

**What starter apps can I used to get started?**

If you'd like to get started quickly we offer several starter templates to get
you going. Just choose one of the following below. These will clone a node.js
app locally for you and create the apropriate `serverless.yaml` file to get you
started. 

```text
## Express JS API
serverless \
    --org=<your-org-name> \
    --name=console-http-api \
    --template=aws-node-express-api \
    --console
```

```text
## Basic Chron Job
serverless \
    --org=<your-org-name> \
    --name=console-chron \
    --template=aws-node-scheduled-cron \
    --console
```

**What languages and runtimes are supported?**

Currently Serverless Console only supports Node.js on AWS Lambda.

**How can I use console to find API Errors?**

Trouble shooting and finding API errors is a valuable way to use Serveless
Console. To identify API Errors, select the HTTP status codes and filter for
500 or other status codes you are interested in visualizing. We recommend [saving a custom view](using/metrics.md)
of your non 200 status code across in your production envorionments across your
org. 

You can use this view to quickly identify anomolies, and then locate the
underlying [Trace](using/traces.md) that caused the problem.

**How can I use console to find slow API Endpoints?**

Slow API responses can negatively impact users and cost your orginization money.
Our metrics and trace explorer allow you to filter on specific endpoints and
environment. From there the p95 metric shows you the worst 5% of API
performance, and the p90 metric shows you the worst 10%. Filtering the traces
for Durations higher than those metrics will lead you to your slowest requests. 


**Should I use Serverless Console to monitor my produciton evironment?**

Go for it! We hope you can find errors, and slowness faster with Serverless
Console, that saidw we know we are lacking key production readiness features
like alerting and logs that are needed before Console should be your only tool. 


**How can I use console to analyze and predict costs?**

We display a cost metric based on the duration and memory used by your Lambda 
function and is based on a x86 price of `$0.0000166667` per Gigabyte second.
Using our cost figure, along wit our filters allows you to understand your
Serveless compute costs across AWS accounts in ways it can be hard to accomplish
otherwise. 

**How much does Serverless Console cost?**

Currently Serverless Console is only available as a Free Trial for potential
enterprise customers. We expect Serverless Console will be priced on based on
the number of Traces (or spans) collected for your orginization. We will be
anouncing final pricing after our private preview is over. 

**What data is stored by Serverless Console and for how long?**

We store a limited set of specified [metrics](concepts/metrics.md) and [tags](/concepts/tags.md)
in our systems for up to 30 days. While this does include meta data about your
systems limited sensitive information is included.

**How secure is Serverless Console?**

Serverless Console is architected with Tenant isolation, and no trust models in
mind. We collect very limited data with potential for PII or other sensitive
information and plan to get SOX compliance for our General Availability. 