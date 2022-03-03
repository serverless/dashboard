<!--
title: Metric Views
menuText: Metric Views
description: A guide to using our metric views and create your own.
menuOrder: 2
-->


## Curated Metric Views 
Our curated metric views provide you the ability to view
activity across your enter Orginization at a glance.  These includes views
are entended to be a starting point based on patterns we 
recognize in the [Trace](../concepts/trace.md) data we receive. 

We focus the patterns around you acheive outcomes important to them
as use cases.

**API's** - Our API view provides convenient tools for troubleshooting
errors and slowness in REST APIs. The API view allows you to quickly
see slow request outliers, filter for status codes, and spot usage
trends across your endpoints. 

**Functions** - Functions provide a view to see all your 
instrumented Lambda functions wholistically across your orginization. 

Fore more details about how we recognize these Traces see our 
[Scopes concept.](../concepts/scopes.md)

### Filters
To further refine our included curated views users can save
filters to further refine the data they are seeing. To add
filters click on the configuration icon in the top right and
select the crtieria you'd like to filter. 

Each filter option will have a set of values we have received
as [tags](tags.md) when we ingestsed the [Trace](trace.md). 
Selec the + icon on each filter option you'd like to include, and
then Save those values to view the results. 

*Note: Saving filters to the curated views for API and Functions
will not be saved across your org. These filters will only apply 
temporarily. 

#### Shared Filters ####
The following filters are shared across all Traces.

* **Service** Service is collected from the *Service.Name* tag
on each Trace. For Serverless Framwork users this will combine
your Stage, Service Name, and function name. 

* **Namespace** Service is collected from the *Service.Namespace* tag
on each Trace. For Serverless Framwork users this will correspond
to service specified in your Serverless.yaml file.

* **Environment** Environment is collected from the *deployment.environment* 
tag. For Serverless Framework users this can be specified as stage.

* **Region** This is collected from the *cloud.region* tag and represents
the region your application is running in. 

#### API Filters ####
The following filters are applicable only to the API Scope. 

* **API Endpoint** Collected using the *http.path* tag this is will 
contain the path for the API requested. This is useful for narrowing in
on usage or error patterns.

* **API Method**  Collected using the *http.method* tag this is will 
contain the method for the API requested. This is useful for distinquishing
between requests across a single endpoint. 

* **API Duration** This is collected as the duration metric and is useful
for identifying performance outliers across your orginization. 

* **API Status Codes**  Collected using the *http.status_code* tag this is will 
contain the status code returned by the API. This is useful for identifiying
errors.

#### Function Filters ####
* **Function Names** Collected using the *faas.name* tag this is the name of the 
function invoked. For Serverless framework users this is specified as the function 
name(s) in the serverless.yaml file. 

* **Function Errors** This is a boolean value collected using the 
*faas.error* tag and allows you to filter on functions that resulted in an error. 

* **Function Cold Start** This is a boolean value collected using the 
*faas.coldstart* tag and allows you to filter on functions that required a cold start.

* **Function Duration** This is collected as the duration metric and is useful
for identifying performance outliers across your orginization. 


### Creating your own views
If you'd like to save filters with your team, you can custom views.

To do this click the "Create View" button on the Scopes Menu and choose
a Scope to apply. It's helpful to include a precise name, and description
so others know the context for the view.  Once created any filters
applied to that view will be shared across the team. 
