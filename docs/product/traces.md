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
for all events instrumented using our [Serverless Console Extension](../integrations/aws/index.md#serverless-console-extension). 


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


## Tags & Tag Definitions

Tagging data on Traces plays an important role in allow you to make sense of
your data. Our [Serverless Console Extension](../integrations/aws/index.md#serverless-console-extension)
instrumentation automatically collects the following tags defined by extending
the [Open Telemetry semantic tagging conventions](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/http.md#common-attributes).
These tags are defined for each trace, but our UI provides an easy way to
navigate them without following the semantic names. 

### Tag Definitions

**Cloud** - Cloud tags identify details specific to your cloud provider. 
- `cloud.region` - This is the region the code is deployed to `us-east-1`.
- `cloud.platform` - This is the type of compute target we are executing in.
Should be set to `lambda`.

**Deployment** - Deployment tags identify details about your specific
deployment.
- `deployment.environment` This is the environment an app is deployed to. It can
be defined as `stage` in `serverless.yaml` file `prod`.

**FAAS Tags** - FAAS tags identify details function as a service platforms like
AWS Lambda.
- `faas.error_timeout` - Set when a timeout of an invocation occurs `TRUE`
- `faas.coldstart` - Set when a cold start of a Lambda function occurs `TRUE` 
- `faas.error` - This boolean is set to true if an invocation resulted in an
error `TRUE`
- `faas.event_type` - "This is the event type that this function was invoked
with `aws.sqs`
- `faas.name` - This the name of the single function that was invoked. 
`console-node-http-api-hello`
- `faas.error_message` The error message if one is captured.
`Exception occurred`

**HTTP Tags** - HTTP tags identify details for HTTP based API's
- `http.path` - This is the http path with the path that includes path param
place holders `/test/{id}`
- `http.method` - This is the http method of the request `GET`
- `http.status_code` - This will be the http status code set on the response
`200`

**Service Tags** - Service tags identify naming details about the underlying
resources of your service. 
- `service.name` This a resource name for the service that your function or
container is running in. For Serverless Framework users this will combine your
stage, service name, and function name. `console-node-http-api`
- `service.namespace` The serverless organization app service name assigned to
this code. This can be specified as the service name in the `serverless.yaml`
file or will be inherited based in your compute environment.
`console-node-http-api`

### Filters

Tags are represented as filters across our [Metrics View](metrics.md), Explorer and [Dev Mode](logs.md).