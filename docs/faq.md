<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 6
-->

# FAQ

## Configuring your apps and services

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

# App is an optional property that enables Serverless Dashboard integration, which can be used together with Serverless Console
app: my-app

# Disable all Dashboard features aside of provider credentials and parameters retrieval
dashboard:
  disableMonitoring: true

# Service name (required)
service: myservice

# Framework version 3.7.1 or higher
frameworkVersion: '3.7.1'

# Function names are provided as filters within Console	
functions:
  hello:

```

Additonally the stage parameter will be included as an environment filter within
Serverless Console.

```text
severless deploy --stage #included as environment
```

## Logging in and signing up

**I am not able to deploy or login to console from the CLI, how do I fix this?**

You need to be on version 3.18+ to login and deploy. To check the version of your framework run.

```text
serverless –version
```

To upgrade to the latest version run.

```text
npm -g install serverless
```
**Where did my organization name come from?**

An organization is a unique tenant within the Serverless suite of products (including Serverless Dashboard, Serverless Cloud, and Serverless Console). This name must be unique, and we randomly assign a combination of words as your organization name if you're using Console for the first time. 

**How does Serverless Console relate to Serveless Dashboard?**

Serverless Console is a new stand alone product, but can leverage functionality
from Serverless Dashboard features for parameters and providers. To take
advantage of these features be sure to set the app property in your
serverless.yaml.

```yaml
org: myorg
app: my-app
console: true
service: myservice
frameworkVersion: '3'
```

Serverles Console also share your orginization and users from Serverless
Dashboard and/or Serverless Cloud. 

## Metrics and Use Cases

**I am not seeing all my details from API-Gateway?**
At this time some details from API gateway are not collected. This means
some errors are not recorded in a Trace. We recommend using a framework
like [Express](../guide/esbuild.md) to assist with capturing a errors.

**What languages and runtimes are supported?**

Currently Serverless Console only supports Node.js on AWS Lambda.

**How can I use console to find API Errors?**

Trouble shooting and finding API errors is a valuable way to use Serveless
Console. To identify API Errors, select the HTTP status codes and filter for
500 or other status codes you are interested in visualizing. We recommend 
[saving a custom view](using/metrics.md)of your non 200 status code across 
in your production envorionments across your org. 

You can use this view to quickly identify anomolies, and then locate the
underlying [Trace](using/traces.md) that caused the problem.

**How can I use console to find slow API Endpoints?**

Slow API responses can negatively impact users and cost your orginization money.
Our metrics and trace explorer allow you to filter on specific endpoints and
environment. From there the p95 metric shows you the worst 5% of API
performance, and the p90 metric shows you the worst 10%. Filtering the traces
for Durations higher than those metrics will lead you to your slowest requests. 


## Pricing and Costs

**How much does Serverless Console cost?**
Serverless Console is priced per 100,000 Transactions for the Pro Tier, and per Million
transactions for the Enterprise tier. Got to your settings page
to sign up today. 

**What is a Transaction?**
A Transaction includes all elements of a [Trace](../product/traces.md) with
some potential overages should your Trace contain an especially
large number of logs, or spans. In most cases overages don't apply 
and your transaction count will closely match your invocation count.

Overages only apply when a Trace has
* > 10kb of logs - a transaction is added for each additional 10kb
* > 100 spans - a transaction is added for each additional 100 spans


**How can I use console to analyze and predict costs?**
We display a cost metric based on the duration and memory used by your Lambda 
function and is based on a x86 price of `$0.0000166667` per Gigabyte second.
Using our cost figure, along wit our filters allows you to understand your
Serveless compute costs across AWS accounts in ways it can be hard to accomplish
otherwise. 

## Data Retention

**What data is stored by Serverless Console and for how long?**

We store a limited set of specified [metrics](product/metrics.md) and [tags](/product/tags.md)
in our systems for up to 30 days. While this does include meta data about your
systems limited sensitive information is included.

Logs are stored for 7 days before being deleted. 

**How can I disable log and event data collection?**
Log and event data can contain sensitive information. 
To disable log, and/or request response data collection 
set the following properties.

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
