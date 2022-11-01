<!--
title: Enabling Additional Monitoring Features
menuText:   Enabling Additional Monitoring Features
description: Enabling Additional Monitoring Features
menuOrder: 4
-->

#   Enabling Additional Monitoring Features
Once you have inventory from your [AWS Observability Integration synched](./index.md#inventory-synching) you will have the ability to enable (or disable), Logs, Traces, and Dev Mode 
for each of your functions. This section provides more details about how each of these features work,
and what you may or may not want to enable them on your function. 

To access settings for individual functions go to Settings -> Integrations -> Edit Integration where you will find a list of resources associated with that AWS Account. 

## Enabling Logs
Enabling logs will create a [Cloudwatch Subscription](../glossary.md#cloudwatch-subscriptions) for the function. This will allow you to scroll through and search for it using [historical logs in dev mode](../product/dev-mode.md#recent-logs). Since log collection leverages Cloudwatch there is no additional Lambda compute time (and cost) associated with log collection. That said there may be bandwidth costs associated with [sending logs across regions](../faq.md#adding-the-aws-observability-integration).


## Enabling Traces
Enabling Traces allows you to inspect the [detailed interactions of a function invocation](../product/traces.md) and [get real time invocation events in dev-mode](../product/dev-mode.md#real-time-invocation-events). This works by including a language specific SDK in your Lambda Function by adding an [layer](../glossary.md#lambda-layer) to your function. Enabling Tracing will also add additional [encoded information](./data-sources-and-roles.md#encoded-log-information) to your logs.

While enabling Traces will not affect the performance of your Lambda functions, it will result in additional billable compute time, and log content. This will result in some increase in cost for Cloudwatch and Lambda services for high volume functions. 

**Note: Tracing is only currently supported on Node.js functions**

## Enabling Dev Mode
Enabling dev mode allows you to [stream real time logs](../product/dev-mode.md#real-time-logging) for your Lambda function. This approach also [adds a layer](../glossary.md#lambda-layer) to your function but does so [externally](data-sources-and-roles.md#external-extension) from your function. This means you can enable dev mode on any runtime and there will be little to no impact to your Lambda cost and performance. 

## Metric Collection
Metrics are collected for all functions by default, and can not be disabled on a per function basis
currently. For more details on all metrics collected see our [data sources](./data-sources-and-roles.md#metric-streams).

## Setting Environment and Namespace Tags
- **Namespace** Namespaces allow you to group Lambda functions together. This can be useful
for tracking Lambda functions associated with a common business outcome (e.g. a shopping-cart). To 
set the Namespace tag go to Settings -> Integrations -> Edit Integration. Each function will have
the ability to select a pre-populated set of Namespaces or add a new one. Only one namespace tag
can be added per function. 

- **Environment** Environment is another way to group sets of functions for filtering. These are used to associate apps across an entire environment such as staging, or production. Environment
can be set by going to Settings -> Integrations -> Edit Integration. Each function will have the ability to select a pre-populated Environment tag, or to create a new one. Additional the environment
tag can be set using the [stage parameter when deploying with Serverless Framework](../integrations/enable-monitoring-features.md#using-framework-to-enable-your-function)

Note, while initial we do detect environment and namespace tags for Environment Variables,  and CloudFormation Stack, the values are stored locally in Serverless Console thereafter. Any changes made within Serverless Console will not be applied directly to your AWS infrastructure. 
