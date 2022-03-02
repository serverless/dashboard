<!--
title: Concepts
menuText: Concepts
description: Overview of concepts used on serevrless console. 
menuOrder: 1
-->

# Concepts 
Serverless Console is built on simple abstractions that fit across all types of 
apps - no matter how it’s built or managed. This is built on the Open Telemetry project 
which focuses observability around standardizing the implementation of tracing. 
Traces occur when something triggers an event in your system, which causes your 
application to be invoked.  When you developer with Serverless Framework, 
or include [Open Telemetry](https://opentelemetry.io/) instrumentation we collect 
and display these traces so you can, chart, debug and alert on them. 

## Tracing
All the observability details about an invocation are captured in a trace. 
All traces have common details for start and end time, metrics, tags, and child 
spans. This structure allows us to offer rich mapping of relationships between 
distributed systems, and help you to troubleshoot and map complex systems quickly 
and is easy to aggregate across many computing platforms and systems.

Sample trace (note this is not an accurate api definition)

```text
 
   FAAS Metrics: 
   
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
           "faas.error_exception_message": "object expected",
           "faas.max_memory": "1024",
           "faas.event_type": "http",
           "http.path": "/user/create",
           "http.method": "POST",
           "http.status_code": "500",
           "http.domain": "my-app.com"
       }

```

## Child Spans
In addition to the metric and tag details, a trace contains a collection of
child spans. These spans share the same attributes as the trace and if your using
OTEL instrumentation across your microsovervices you'll be able
to see how long these span execution took and use them further drill into
where issues are occuring. 

