<!--
title: Concepts
menuText: Concepts
description: Overview of concepts used on serevrless console. 
menuOrder: 2
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

```json
{
   "id": "fd432523c9a0d72e0b6d4886dd68eed6",
   "startTimeUnixNano": "1644420233494556000",
   "endTimeUnixNano": "1644420233494669600",
   "spans": [] //nested list of span ids, or possibly nested json
   "tags": [
       {
           "faas.name": "my-lambda",
           "cloud.region": "us-east1",
           "service.namespace": "my-app",
           "faas.memory_pct": "41.2",
           "faas.error_timeout": "false",
           "faas.coldstart": "false",
           "deployment.environment": "prod",
           "sls.org_uid": "fd4325dee56c1-3b17-4254-82b6-39af3a892ba0",
           "http.path": "/user/create",
           "http.method": "POST",
           "http.status_code": "500",
           "http.domain": "my-app.com",
           "faas.duration": "123",
           "faas.error": "true",
           "faas.error_exception_message": "object expected",
           "faas.max_memory": "1024",
           "faas.event_type": "http",
           "cloud.provider": "aws",
           "cloud.platform": "lambda"
       }
   ]
   metrics:[
       { "faas.duration": 123},
       { "faas.memory_pct": 22}
   ]
}
```

## Child Spans
Child spans share the same data structure as above but offer a seperate
