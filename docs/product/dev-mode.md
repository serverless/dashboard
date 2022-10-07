<!--
title: Dev Mode
menuText: Dev Mode
description: A guide for using logs within Serverless Console
menuOrder: 5
-->

# Development Mode
Dev(elopment) Mode is an optimized development focused suite of Observability
tools for building and troubleshooting Serverless architectures. To get started you need [enable dev mode](../integrations/enable-monitoring-features.md) on
your functions.

Once you have your function(s) enabled for Dev Mode you will 
see an aggregate stream of [logs](#real-time-logging), [invocation events](#real-time-invocation-events), and [spans](#spans)
for your function. You may need to filter for a namespace
or environment to better troubleshoot your application.

## Real Time Logging
Using log statements is one of the more intuitive approach troubleshooting
and Serverless Console offers you a best in class experience to using logs 
across your Lambda Function. 

Once you have [enabled dev mode](../integrations/enable-monitoring-features.md#enabling-dev-mode) you will start seeing logs forwarded directly from your Lambda function. 
[Historical logs](#historical-logs) for your function are also collected using
[CloudWatch Log Subscriptions](../integrations/data-sources-and-roles.md#cloudwatch-log-subscriptions). 

## Real Time Invocation Events
Every function invocation will have a start and end event so even if your
function does not output any logs, you can monitor it's interactions. Development mode 
is intended to allow you to isolate important events as they happen, and further
inspect the details of that event and logs.

When you click on an event the side panel will show the following key pieces of information.

* **Started and Ended events** - These will be inserted into the log stream to help
showcase when an a Lambda function has started executed, and when it completes. 
* **Event Payload** - This structured (JSON) data has details about the event that triggered
the function, and details about which ARN was executed. This help you identify precisely what
inputs, and software version may have caused an issue.
* **Log Lines** - You can group all the logs from a single invocation in the sidebar by clicking 
in your log stream. The start and event, or log lines will open this transaction sidebar.

## Historical Logs
Development mode works similar to a terminal display in that the most recent 
logs appear at the bottom of the screen automatically, unless you are scrolling
upwards. This is deigned to be used in conjunction with fitters which allow you to
isolate specific interactions you care about.

## Filtering
The default view for dev mode is across all your logs and invocations, so you will
likely need to apply filters to meaningfully utilize Dev Mode. We recommend filtering 
by [Namespace](../glossary.md#namespace) or [Environment] but you can also utilize
this to do keyword searches such as a user-id, or tag.

## Log Formatting
Where possible we detect and format structured logs such as JSON. We also include
encoded information in logs if you [enable Tracing](../integrations/enable-monitoring-features.md#enabling-traces) on a function but this is hidden in development mode. 