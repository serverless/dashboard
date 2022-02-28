<!--
title: Tags
menuText: Tags
description: Tag definitions and examples
menuOrder: 3
-->

# Tags & Tag Definitions
Any Trace or Span we collect has a set of Tags that is used to define data used
to drive filtering within the Console. This data is automatically collected by
our instrumentation, and in the future we intend to allow developers to add their 
own Tags. We use and enforce a semantically defined naming approach based on 
the Open Telemetry tags standard definition


|Tag Name (OTEL Attribute)|Tag Description |Required for Scopes|Sample Value|Trace Only|
|sls.org_uid|The serverless organization id that the code belongs to. This is required for all traces.|global|c492b73f-3704-4d5b-839a-d4fbc7adc328||
|faas.collector_version|String for describing the name and version of the collector userd|function|sls.faas.v0.0.4||
|faas.name|This the name of the single function that was invoked.|function|otel-sample-http-api-danj-simpleRequest||
|service.name|This the name of the single function that was invoked.|function|otel-sample-http-api-danj-simpleRequest||
|faas.error_timeout|Set when a timeout of an invocation occurs|function|TRUE||
|faas.coldstart|Set when a coldstart of a Lambda function occurs.|function|TRUE||
|faas.error|This boolean is set to true if an invocation resulted in an error|function|TRUE||
|faas.max_memory|The amount of memory available to the serverless function in MiB. |function|256||
|faas.event_type|"This is the event type that this function was invoked with (API Gateway| SNS| SQS| Kinesis| etc)"|function|aws.sqs||
|http.path|This is the http path with the path that includes path param place holders|api|/test/{id}||
|http.method|This is the http method of the request |api|GET||
|http.status_code|This will be the http status code set on the response|api|200||
|http.domain|This is the domain of the app |api|||
|faas.memory_pct|Equivalent to memory metric measure this attribute is only assigned to the trace||9.456|x|
|faas.duration|"This is the duration of the execution. (In a faas environment it will be function duration in a container environemnt it will be the duration of the request| work task| etc)"||1256|x|
|deployment.environment|"This is the environment an app is deployed to. It can be defined as ""stage"" in serverlss.yaml file"||danj||
|cloud.region|This is the region the code is deployed to||us-east-1||
|service.namespace|The serverless organization app service name assigned to this code. This can be specified as the service name in the serverless.yaml file or will be inherited based in your compute envirionment.||otel-sample-http-api||
|faas.error_exception_stacktrace|The stack trace for the invocation that resulted in an error.|||x|
|faas.error_exception_message|The error message if an one is captured during an invocation that results in an error.  ||Sorry dude|x|
|aws.xray.trace_id|Thsi is the x-ray trace id that is assigned to the resource||Root=1-61f800c6-62f31c575c176060231b0311|x|
|sls.deployment_uid|The serverless cli generated deployment uid||c492b73f-3704-4d5b-839a-d4fbc7adc328|x|
|faas.id|The unique ID of the single function that this runtime instance executes. (This is from the otel docs)||arn:aws:lambda:us-east-1:762003938904:function:otel-sample-v1-api-danj-simpleRequest|x|
|faas.version|The immutable version of the function being executed||$Latest|x|
|faas.instance|"The execution environment ID as a string| that will be potentially reused for other invocations to the same function/function version. "||2022/02/02/[$LATEST]a0216f09b210438395fee90aeddbe30e|x|
|cloud.provider|This is the cloud provider name. Right now all we have is aws||aws||
|faas.execution_id|This will be the execution id that is associated with this particular invocation||d4f57e7d-b994-44c9-b00a-0369870ed9f2|x|
|cloud.platform|This is the type of compute target we are executing in. Should be set to `lambda`||lambda||