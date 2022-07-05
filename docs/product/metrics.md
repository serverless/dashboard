<!--
title: Metrics
menuText: Metrics
description: A guide to using our metric views and create your own.
menuOrder: 6
-->

# Metrics 

Metrics about your [Trace](traces.md) are collected and stored in Serverless
Console. These metrics are stored individually on each trace as well as
aggregated for storage and alerting purposes. The [tags](tags.md) from your
trace are also included on these metrics for filtering.

Our curated metric views provide you the ability to view activity across your
entire organization at a glance.  These include views are intended to be a
starting point based on patterns we recognize in the [Trace](traces.md)
data we receive. 

Our metrics are built around common use cases including:

**API's** - Our API view provides convenient tools for troubleshooting errors
and slowness in REST APIs. The API view allows you to quickly see slow request
outliers, filter for status codes, and spot usage trends across your endpoints. 

**Functions** - Functions provide a view to see all your instrumented Lambda
functions holistically across your organization. 

## Collected Metrics
Currently the following metrics are supported for ingestion.

**FAAS Compute Duration** - This metric is used for collecting details about the
total time it took for a given Trace which is used for calculating costs. 

**FAAS Memory Percent**  - This is the memory percentage used for a function
invocation.

## Filters

To further refine our included curated views users can save filters to further
refine the data they are seeing. To add filters click on the configuration icon
in the top right and select the criteria you'd like to filter. 

Each filter option will have a set of values we have received as
[tags](tags.md) when we ingested the [Trace](traces.md). Select the
**+** icon on each filter option you'd like to include, and then Save those
values to view the results. 

**Note**: Saving filters to the curated views for API and Functions will not be
saved across your org. These filters will only apply temporarily. 

### Shared Filters

The following filters are shared across all Traces.

- **Service** Service is collected from the `service.name` tag on each Trace.
For Serverless Framework users this will combine your Stage, Service Name, and
function name. 
- **Namespace** Service is collected from the `service.namespace` tag on each
Trace. For Serverless Framework users this will correspond to service specified
in your Serverless.yaml file.
- **Environment** Environment is collected from the `deployment.environment` 
tag. For Serverless Framework users this can be specified as stage.
- **Region** This is collected from the `cloud.region` tag and represents the
region your application is running in. 

### API Filters
The following filters are applicable only to the API Scope. 

- **API Endpoint** Collected using the `http.path` tag this is will contain the
path for the API requested. This is useful for narrowing in on usage or error
patterns.
- **API Method**  Collected using the `http.method` tag this is will contain the
method for the API requested. This is useful for distinguishing between requests
across a single endpoint. 
- **API Duration** This is collected as the duration metric and is useful for
identifying performance outliers across your organization. 
- **API Status Codes**  Collected using the `http.status_code` tag this will 
contain the status code returned by the API. This is useful for identifying
errors.

### Function Filters
 The following filters are applicable only to the function Scope.

- **Function Names** Collected using the `faas.name` tag this is the name of the 
function invoked. For Serverless framework users this is specified as the
function name(s) in the serverless.yaml file. 
- **Function Errors** This is a boolean value collected using the `faas.error`
tag and allows you to filter on functions that resulted in an error. 
- **Function Cold Start** This is a boolean value collected using the 
`faas.coldstart` tag and allows you to filter on functions that required a cold
start.
- **Function Duration** This is collected as the duration metric and is useful
for identifying performance outliers across your organization. 

## Creating your own views

If you'd like to save filters with your team, you can create shared custom views.

To do this click the "Create View" button on the Scopes Menu and choose a Scope
to apply. It's helpful to include a precise name, and description so others know
the context for the view.  Once created any filters applied to that view will be
shared across the team. 
