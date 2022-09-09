<!--
title: Enabling Logs and Traces
menuText:   Enabling Logs and Traces
description:  Enabling Logs and Traces
menuOrder: 4
-->

#   Enabling Logs and Traces
Once you have inventory from your [AWS Observability Integration synched](./index.md#inventory-synching) you will have the option to enable 
logs and traces on each of your functions. 

## Enabling Logs
Enabling logs will allow you to take advantage of [real time log streaming in dev mode](../product/logs.md#real-time-logging-in-dev-mode). Enabling logs will create a Cloudwatch Subscription 
for this function and send log data to Serverless Console and is recommended for functions
where you are actively developing or troubleshooting. 

## Enabling Traces
Enabling Traces will give you more details view of what occurs in a function invocation.
This works by adding a Layer to your AWS Lambda function which includes specific log attribution
details that allow us to tag and identify interactions with other services that originated from
a particular event. Currently this is limited to Node.js runtime only. 

## Metric Collection
Metrics are collected for all functions by default, and can not be disabled on a per function basis
currently. 

## Using Framework to Enable your Function
You can set the following properties in your `serverless.yaml` file
for various features within Serverless Console.  This will allow you to continue 
use existing Serverless Framework workflows with Serverless Console.


```yaml

# Organization name (required)
org: myorg

# 
console: true # this will enable both logs and tracing for the specified function
    monitoring: #these properties allow you to enabled options independently
      logs: 
        disable: true
      trace:
        disable: true
      
# Service name (required)
service: myservice

# Framework version 3.23 or higher
frameworkVersion: '3.23'
```

In addition to these properties the `ENVIRONMENT` is also based
on the stage you use during the deploy command. 

```text
serverless deploy --stage #included as environment
```
