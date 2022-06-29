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

## Spans

A Trace contains a set of Spans associated with and displayed in the style of a 
Gant Chart. This chart provides you with context for when, and 
how long various subsequent interactions took. 

For more details about Spans see our [Example Trace](#example-trace).

## Tags and Metrics

Each Trace has some optional metrics (like Duration and Memory) as well as
Tags we use to filter, and chart them. These details are exposed in the Trace
Detail view. 


## Explorer View

Similar to our [Metrics View](metrics.md) the Trace Explorer provides you a
starting point for discovering errors, or slowness across your Organization.
Similar to metrics views you can apply filters to narrow in on errors, slowness
or usage patterns across your organization. 

Traces share the same set of filters from our [Metrics View](metrics.md) but are
not saved.

## Detail View

Trace details provide the specifics about an event happening in your system. The
Trace has a set of Metrics we collect, Tags, used for filtering, and Spans
for all events instrumented using our [Serverless Console Extension](../platform/extension.mdd)
collectors. 


### Example Trace

Sample Trace (simplified view)
```text
id: 4d5a34403976b89eea314d3cc8035c36
FAAS Metrics: (Optional)
   
    Memory: 1021 KB
    Duration 123ms
 
"tags": 
{
    "service.namespace": "my-app",
    "faas.name": "my-lambda",
    "cloud.region": "us-east1",
    "cloud.provider": "aws",
    "cloud.platform": "lambda",
    "deployment.environment": "prod",
    "faas.error_timeout": "false",
    "faas.coldstart": "false",
    "faas.error": "true",
    "faas.error_message": "object expected",
    "faas.max_memory": "1024",
    "faas.event_type": "http",
    "http.path": "/user/create",
    "http.method": "POST",
    "http.status_code": "500",
    "http.domain": "my-app.com"
}

```
