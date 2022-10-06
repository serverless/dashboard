<!--
title: Logs
menuText: Logs
description: A guide for using logs within Serverless Console
menuOrder: 5
-->

# Development Mode
To make the most of your troubleshooting and development
experience it is recommended to [enable logs](../integrations/enable-monitoring-features.md) on
your functions. This collects logs from your function using Cloudwatch Subscriptions. 

By default Dev Mode gives you an aggregated stream of all the
logs and function invocations for your org so that you can isolate
and troubleshoot recent events. We recommended keeping dev mode open
while you test your functions so you can quickly recreate precisely 
what inputs are causing certain behavior in your application. 

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

## Real Time Logging
Using log statements is one of the more intuitive approach troubleshooting
and Serverless Console offers you a best in class experience to using logs 
across your Lambda Function. 

## Recent Logs
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