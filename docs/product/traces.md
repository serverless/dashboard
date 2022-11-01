<!--
title: Traces
menuText: Traces
description: Using Explorer and understanding Traces and Spans.
menuOrder: 7
-->
# Traces

Within Serverless Console all the observability details about your apps and services are
captured as Traces. All Traces have a unique identifier, some optional
[metrics](metrics.md) and [tags](tags.md), as well as an array of [spans](#spans).
This structure allows us to offer rich filtering controls, and sequence diagrams.  

To do this we provided a set of tools for analyzing Traces

## Explorer View

Similar to our [Metrics View](metrics.md) the Trace Explorer provides you a
starting point for discovering errors, or slowness across your Organization.
Similar to metrics views you can apply filters to narrow in on errors, slowness
or usage patterns across your organization. 

Traces share the same set of filters from our [Metrics View](metrics.md) but are
not saved.

### Filters
Filtering allows you to narrow in on particular behavior and time frame for 
to isolate invocations. You can filter on.

* Failures - sorting by failures will show you Lambda functions that failed to execute successfully (does not require tracing to be enabled).
* Errors - sorting by errors allows you to surface errors you have captured (requires [tracing be enabled](../integrations/enable-monitoring-features.md#enabling-traces))
* [Namespace and environment](../glossary.md#namespace) - Namespaces and environments give you the ability to filter for distinct collection of functions. 
* AWS Accounts - Names/numbers of any AWS Accounts that are sending Log or Trace data to console.
* Function Names - Functions that are sending Log or Trace data to console.
* Regions - Regions that are sending Log or Trace data to console.


## Traces from Logs
Even when Traces are not enabled we generate traces from logs based on Logs for 
each Lambda invocation. This means you can use the Trace Explorer without enabling
traces to find older invocations.

## Trace Details
A Trace allows you to understand the overall lifecycle, interactions, and
timing of your Lambda function along with it's Logs and Metrics.  

### Spans
A Trace contains a set of Spans associated with and displayed in the style of a 
Gant Chart. This chart provides you with context for when, and 
how long various subsequent interactions took. 

The following spans related to AWS Lambda [execution environment](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html).

* **Initialization** This will appear under the span `aws.lambda.initialization` and will contain details about cold starts.
* **Invocation** This will contain details about the execution of your function. 

Read more details about [understanding duration](./duration.md) and our
[node SDK support for child spans](../integrations/data-sources-and-roles.md#supported-child-spans)

### Tags and Metrics
Each Trace has a set of associated tags, and metrics. These include the [filters above](#filters) as well as metrics for [duration](./duration.md). In addition to the filters above the Trace also has details about.

* **Request Id** - This is a unique id used on your trace. It is used to associate logs and metrics for a Trace.
* **Arch** - This is the architecture (x86_64 or ARM64) that executed the function.
* **Max Memory** - This is the Max Memory in MB used by your function.
* **Version** - This is the version of the function that executed.
* **Outcome** - 
* **Log Group** - This is the Log Group where you can find logs for this function.
* **Log Stream Name** - This is the Log Stream we used to collect logs for this function.






