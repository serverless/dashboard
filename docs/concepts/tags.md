<!--
title: Tags
menuText: Tags
description: Tag definitions and examples
menuOrder: 3
-->

# Tags & Tag Definitions
Tagging data on Traces plays an important role in allow you to make sense of
[Open Telemetry](https://opentelemetry.io/) data. Our [Serverless Runtime](https://github.com/serverless/runtime)
instrumentation automatically collects the following tags defined by extending
the [Open Telemetry semantic tagging conventions](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/http.md#common-attributes). 
These tags are defined for each trace, but our UI provides an easy way to navigate
them without following the Semantic names. 

* **cloud.region** - This is the region the code is deployed to *us-east-1*
* **cloud.platform** - This is the type of compute target we are executing in. Should be set to *lambda*

* **deployment.environment** This is the environment an app is deployed to. It can be defined as ""stage"" in serverlss.yaml file *prod*

* **http.path** - This is the http path with the path that includes path param place holders */test/{id}*
* **http.method** - This is the http method of the request *GET*
* **http.status_code** - This will be the http status code set on the response *200*

* **faas.error_timeout** - Set when a timeout of an invocation occurs *TRUE*
* **faas.coldstart** - Set when a coldstart of a Lambda function occurs. *TRUE* 
* **faas.error** - This boolean is set to true if an invocation resulted in an error *TRUE*
* **faas.event_type** - "This is the event type that this function was invoked with *aws.sqs*
* **faas.name** - This the name of the single function that was invoked. *console-node-http-api-hello*

* **service.name** This a resource name for the service that your function or contain is running in. *console-node-http-api*
* **service.namespace** The serverless organization app service name assigned to this code. 
This can be specified as the service name in the `serverless.yaml` file or will be 
inherited based in your compute envirionment. *console-node-http-api*





|faas.error_exception_stacktrace|The stack trace for the invocation that resulted in an error.|||x|
|faas.error_exception_message|The error message if an one is captured during an invocation that results in an error.  ||Sorry dude|x|
|aws.xray.trace_id|Thsi is the x-ray trace id that is assigned to the resource||Root=1-61f800c6-62f31c575c176060231b0311|x|
|sls.deployment_uid|The serverless cli generated deployment uid||c492b73f-3704-4d5b-839a-d4fbc7adc328|x|


