<!--
title: Traces
menuText: Traces
description: Defining Traces and Spans 
menuOrder: 2
-->

## Tracing
Within console all the observability details about your apps 
and services are captured as Traces. All Traces have a unique 
identifier, some optional [metrics](metrics.md) and [tags](tags.md), 
as well as an array of child spans. This structure allows us 
to offer [rich filtering controls](../using/metrics.md), [structure
sequence diagrams](../using/traces.md) from with the Console
User Interface.  We also use tags to enforce a set of [scopes](scopes.md)
to ensure we recognize the data being ingested.

Sample Trace (simplified view)
```text
id: 4d5a34403976b89eea314d3cc8035c36
FAAS Metrics: (Optional)
   
    Memory: 1021 KB
    Copmute Duration 123ms
 
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
Traces also contain a collection of Child Spans. These spans 
provide more detailed specifics about the start adn stop times 
of events instrumented with our Serverless Runtime collectors. 

These share the same [tagging](tags.md) and unique identifiers as a T
race and allow us to reconstruct the interactions of your application.


Sample Spans (simplified view)
```text
parent-id: 4d5a34403976b89eea314d3cc8035c36
|------id: 2d95fe3eec77a0098d15a6995943b670

 
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
|------id: b91975df2f5144949ff95613496c97f3 
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

