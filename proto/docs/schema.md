# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [serverless/instrumentation/tags/v1/aws.proto](#serverless_instrumentation_tags_v1_aws-proto)
    - [AwsApiGatewayTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags)
    - [AwsApiGatewayTags.AwsApiGatewayRequestTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags-AwsApiGatewayRequestTags)
    - [AwsLambdaInitializationTags](#serverless-instrumentation-tags-v1-AwsLambdaInitializationTags)
    - [AwsLambdaInvocationTags](#serverless-instrumentation-tags-v1-AwsLambdaInvocationTags)
    - [AwsLambdaTags](#serverless-instrumentation-tags-v1-AwsLambdaTags)
    - [AwsSdkDynamodbTags](#serverless-instrumentation-tags-v1-AwsSdkDynamodbTags)
    - [AwsSdkSnsTags](#serverless-instrumentation-tags-v1-AwsSdkSnsTags)
    - [AwsSdkSqsTags](#serverless-instrumentation-tags-v1-AwsSdkSqsTags)
    - [AwsSdkTags](#serverless-instrumentation-tags-v1-AwsSdkTags)
    - [AwsSnsEventTags](#serverless-instrumentation-tags-v1-AwsSnsEventTags)
    - [AwsSqsEventTags](#serverless-instrumentation-tags-v1-AwsSqsEventTags)
    - [AwsTags](#serverless-instrumentation-tags-v1-AwsTags)
    - [HttpRouterTags](#serverless-instrumentation-tags-v1-HttpRouterTags)
  
    - [AwsLambdaTags.Outcome](#serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome)
  
- [serverless/instrumentation/tags/v1/common.proto](#serverless_instrumentation_tags_v1_common-proto)
    - [HttpTags](#serverless-instrumentation-tags-v1-HttpTags)
  
- [serverless/instrumentation/tags/v1/error.proto](#serverless_instrumentation_tags_v1_error-proto)
    - [ErrorTags](#serverless-instrumentation-tags-v1-ErrorTags)
  
    - [ErrorTags.ErrorType](#serverless-instrumentation-tags-v1-ErrorTags-ErrorType)
  
- [serverless/instrumentation/tags/v1/tags.proto](#serverless_instrumentation_tags_v1_tags-proto)
    - [SdkTags](#serverless-instrumentation-tags-v1-SdkTags)
    - [SlsTags](#serverless-instrumentation-tags-v1-SlsTags)
    - [Tags](#serverless-instrumentation-tags-v1-Tags)
  
- [serverless/instrumentation/v1/dev_mode.proto](#serverless_instrumentation_v1_dev_mode-proto)
    - [DevModePayload](#serverless-instrumentation-v1-DevModePayload)
    - [LambdaTelemetry](#serverless-instrumentation-v1-LambdaTelemetry)
  
- [serverless/instrumentation/v1/event.proto](#serverless_instrumentation_v1_event-proto)
    - [Event](#serverless-instrumentation-v1-Event)
    - [EventPayload](#serverless-instrumentation-v1-EventPayload)
  
- [serverless/instrumentation/v1/log.proto](#serverless_instrumentation_v1_log-proto)
    - [LogEvent](#serverless-instrumentation-v1-LogEvent)
    - [LogPayload](#serverless-instrumentation-v1-LogPayload)
  
- [serverless/instrumentation/v1/metric.proto](#serverless_instrumentation_v1_metric-proto)
    - [Metric](#serverless-instrumentation-v1-Metric)
    - [Metric.ValueAtQuantile](#serverless-instrumentation-v1-Metric-ValueAtQuantile)
    - [MetricPayload](#serverless-instrumentation-v1-MetricPayload)
  
- [serverless/instrumentation/v1/request_response.proto](#serverless_instrumentation_v1_request_response-proto)
    - [RequestResponse](#serverless-instrumentation-v1-RequestResponse)
  
    - [RequestResponse.Origin](#serverless-instrumentation-v1-RequestResponse-Origin)
  
- [serverless/instrumentation/v1/trace.proto](#serverless_instrumentation_v1_trace-proto)
    - [Span](#serverless-instrumentation-v1-Span)
    - [TracePayload](#serverless-instrumentation-v1-TracePayload)
  
- [Scalar Value Types](#scalar-value-types)



<a name="serverless_instrumentation_tags_v1_aws-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/aws.proto



<a name="serverless-instrumentation-tags-v1-AwsApiGatewayTags"></a>

### AwsApiGatewayTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| account_id | [string](#string) |  | The AWS Account ID of the API GW. |
| api_id | [string](#string) |  | The unique id used for the API GW. |
| api_stage | [string](#string) |  | The stage of the API GW endpoint that was called. |
| request | [AwsApiGatewayTags.AwsApiGatewayRequestTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags-AwsApiGatewayRequestTags) |  |  |






<a name="serverless-instrumentation-tags-v1-AwsApiGatewayTags-AwsApiGatewayRequestTags"></a>

### AwsApiGatewayTags.AwsApiGatewayRequestTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [string](#string) |  | The unique API GW Request ID. |
| time_epoch | [uint64](#uint64) |  | The request time in milliseconds from epoch. |
| path_parameter_names | [string](#string) | repeated | JSON string containing Request Path Parameters |






<a name="serverless-instrumentation-tags-v1-AwsLambdaInitializationTags"></a>

### AwsLambdaInitializationTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| initialization_duration | [uint32](#uint32) |  | The Initialization Duration of the Lambda Function. This is one part of the billed duration. Maps to the Cloudwatch Logs Report &#34;Init Duration&#34; |






<a name="serverless-instrumentation-tags-v1-AwsLambdaInvocationTags"></a>

### AwsLambdaInvocationTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| invocation_duration | [uint32](#uint32) |  | The Invocation Duration of the Lambda Function. This is one part of the billed duration. Maps to the Cloudwatch Logs Report &#34;Duration&#34; |






<a name="serverless-instrumentation-tags-v1-AwsLambdaTags"></a>

### AwsLambdaTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| arch | [string](#string) |  | The architecture of the Lambda function, currently either amd64 or arm64. |
| is_coldstart | [bool](#bool) |  | Was the invocation a cold start? |
| event_type | [string](#string) | optional | The event type for the invocation. |
| event_source | [string](#string) | optional | The event source for the invocation. |
| log_group | [string](#string) | optional | The Log Group for the Lambda Function. |
| log_stream_name | [string](#string) | optional | The Log Stream for the invocation. |
| max_memory | [uint32](#uint32) | optional | The Max Memory that is configured for the Lambda Function. |
| name | [string](#string) |  | The Lambda Function name. |
| request_id | [string](#string) |  | The Request ID for the invocation. |
| version | [string](#string) |  | The Lambda Function version. |
| account_id | [string](#string) | optional | The AWS Account ID of the Lambda Function |
| outcome | [AwsLambdaTags.Outcome](#serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome) |  | The Outcome of the Lambda invocation |
| error_exception_message | [string](#string) | optional | Optional error exception message. |
| error_exception_stacktrace | [string](#string) | optional | Optional error exception stacktrace. |
| duration | [uint32](#uint32) | optional | The billed duration of the invocation in milliseconds. This will not be available when instrumented, this will be upserted into this tag set after the report log from Cloudwatch is available. |
| request_body | [string](#string) | optional | Request body |
| response_body | [string](#string) | optional | Response body |
| sqs | [AwsSqsEventTags](#serverless-instrumentation-tags-v1-AwsSqsEventTags) | optional | Will be set if the function is handling a SQS event |
| sns | [AwsSnsEventTags](#serverless-instrumentation-tags-v1-AwsSnsEventTags) | optional | Will be set if the function is handling a SNS event |
| http | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | Will be set if the function is handling HTTP requests via any method, API GW, Function URLs, etc. |
| api_gateway | [AwsApiGatewayTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags) | optional | Will be set if the function is handling HTTP requests via AWS API GW |
| http_router | [HttpRouterTags](#serverless-instrumentation-tags-v1-HttpRouterTags) | optional | Will be set if function is handling HTTP requests and there&#39;s routing functionality setup |
| initialization | [AwsLambdaInitializationTags](#serverless-instrumentation-tags-v1-AwsLambdaInitializationTags) | optional | The root AWS Lambda Span tags. |
| invocation | [AwsLambdaInvocationTags](#serverless-instrumentation-tags-v1-AwsLambdaInvocationTags) | optional | The AWS Lambda Invocation tags. |






<a name="serverless-instrumentation-tags-v1-AwsSdkDynamodbTags"></a>

### AwsSdkDynamodbTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| table_name | [string](#string) | optional | The DynamoDB table name |
| projection | [string](#string) | optional | The value of the ProjectionExpression request parameter. |
| scan_forward | [bool](#bool) | optional | The value of the ScanIndexForward request parameter. |
| attributes_to_get | [string](#string) | repeated | The value of the AttributesToGet request parameter. |
| consistent_read | [bool](#bool) | optional | The value of the ConsistentRead request parameter. |
| index_name | [string](#string) | optional | The value of the IndexName request parameter. |
| limit | [uint32](#uint32) | optional | The value of the Limit request parameter. |
| select | [string](#string) | optional | The value of the Select request parameter. |
| segment | [uint32](#uint32) | optional | The value of the Segment request parameter. |
| total_segments | [uint64](#uint64) | optional | The value of the TotalSegments request parameter. |
| filter | [string](#string) | optional | The value of the FilterExpression request parameter. |
| key_condition | [string](#string) | optional | The value of the KeyConditionExpression request parameter. |
| exclusive_start_key | [string](#string) | optional | JSON string of the ExclusiveStartKey request parameter. |
| attribute_values | [string](#string) | optional | JSON string of the ExpressionAttributeValues request parameter. |
| count | [uint64](#uint64) | optional | The value of the Count response parameter. |
| scanned_count | [uint64](#uint64) | optional | The value of the ScannedCount response parameter. |






<a name="serverless-instrumentation-tags-v1-AwsSdkSnsTags"></a>

### AwsSdkSnsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| topic_name | [string](#string) | optional | The SNS Topic name taken from the TopicArn request parameter. |
| message_ids | [string](#string) | repeated | The message IDs provided in the SDK operation response. |






<a name="serverless-instrumentation-tags-v1-AwsSdkSqsTags"></a>

### AwsSdkSqsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| queue_name | [string](#string) | optional | The SQS queue name |
| message_ids | [string](#string) | repeated | The message IDs provided in the SDK operation response. |






<a name="serverless-instrumentation-tags-v1-AwsSdkTags"></a>

### AwsSdkTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| region | [string](#string) | optional | The AWS Region this SDK call is being made against. |
| signature_version | [string](#string) | optional | AWS Authentication signature version of the request. |
| service | [string](#string) |  | The name of the service to which a request is made. |
| operation | [string](#string) |  | The name of the operation corresponding to the request. |
| request_id | [string](#string) | optional | The unique ID of the request. |
| error | [string](#string) | optional | An optional error returned from the AWS APIs. |
| dynamodb | [AwsSdkDynamodbTags](#serverless-instrumentation-tags-v1-AwsSdkDynamodbTags) | optional |  |
| sqs | [AwsSdkSqsTags](#serverless-instrumentation-tags-v1-AwsSdkSqsTags) | optional |  |
| sns | [AwsSdkSnsTags](#serverless-instrumentation-tags-v1-AwsSdkSnsTags) | optional |  |






<a name="serverless-instrumentation-tags-v1-AwsSnsEventTags"></a>

### AwsSnsEventTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| topic_name | [string](#string) |  | Taken from the TopicARN |
| message_ids | [string](#string) | repeated | Introspected from the events records |






<a name="serverless-instrumentation-tags-v1-AwsSqsEventTags"></a>

### AwsSqsEventTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| queue_name | [string](#string) |  | Taken from the eventSourceARN |
| message_ids | [string](#string) | repeated | Introspected from the events records |






<a name="serverless-instrumentation-tags-v1-AwsTags"></a>

### AwsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| lambda | [AwsLambdaTags](#serverless-instrumentation-tags-v1-AwsLambdaTags) | optional | The root AWS Lambda Span tags |
| sdk | [AwsSdkTags](#serverless-instrumentation-tags-v1-AwsSdkTags) | optional | The AWS SDK Tags. These are only added when instrumented code makes a call to one of the AWS SDK functions |
| account_id | [string](#string) | optional | Account Id is added to all schemas originating from aws during ingest as part of our data enrichment process |
| region | [string](#string) | optional | Region is added to all schemas originating from aws during ingest as part of our data enrichment process |
| request_id | [string](#string) | optional | RequestId is added to all schemas originating from aws lambda during ingest as part of our data enrichment process |
| resource_name | [string](#string) | optional | ResourceName is added to all schemas originating from aws lambda during ingest as part of our data enrichment process |
| sequence_id | [string](#string) | optional | The monotonically increasing sequence id for a LogEvent originating from aws lambda. This is used to determine the ordering of messages in a given stream of logs. If this is a LogEvent coming from Cloudwatch Logs, it will be provided otherwise it is the responsibility of the log producer to generate a sequence id. |
| log_group | [string](#string) | optional | The Cloudwatch Log Group name for logs originating from aws lambda. |
| log_stream | [string](#string) | optional | The Cloudwatch Log Group Stream id for logs originating from aws lambda. |






<a name="serverless-instrumentation-tags-v1-HttpRouterTags"></a>

### HttpRouterTags
Describe routing of incoming HTTP requests.
Reflects configuration of a router used to route the request
It can be Express.js, or API Gateway if Express.js is not detected to be used


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| path | [string](#string) |  | The HTTP Path defined by the route handler (either express or API Gateway) |





 


<a name="serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome"></a>

### AwsLambdaTags.Outcome
A Lambda function invocation can have one of the following
outcomes upon completion.

| Name | Number | Description |
| ---- | ------ | ----------- |
| OUTCOME_UNSPECIFIED | 0 | No outcome was registered. Either information on the outcome was not disclosed (which should never be the case), or the function invocation has not been finalized yet |
| OUTCOME_SUCCESS | 1 | Function handler returned successfully |
| OUTCOME_ERROR_INITIALIZATION | 2 | Function crashed at initialization |
| OUTCOME_ERROR_UNHANDLED | 3 | Function crashed in an unhandled way at invocation (a result of either uncaught exception or unhandled rejection) |
| OUTCOME_ERROR_TIMEOUT | 4 | Function timed out |
| OUTCOME_ERROR_HANDLED | 5 | Function handler resolved with an error (either error was passed to lambda callback, or async handler resolved with error rejection) |


 

 

 



<a name="serverless_instrumentation_tags_v1_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/common.proto



<a name="serverless-instrumentation-tags-v1-HttpTags"></a>

### HttpTags
Generic tagset intended to describe incoming or outgoing HTTP requests


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| method | [string](#string) |  | The method of the HTTP Request |
| protocol | [string](#string) |  | The protocol of the HTTP Request |
| host | [string](#string) |  | The host of the HTTP Request |
| path | [string](#string) |  | The path of the HTTP Request |
| query_parameter_names | [string](#string) | repeated | Names of the query parameters |
| request_header_names | [string](#string) | repeated | Request header names |
| status_code | [uint32](#uint32) | optional | The Response Status Code. |
| error_code | [string](#string) | optional | Eventual request error code |





 

 

 

 



<a name="serverless_instrumentation_tags_v1_error-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/error.proto



<a name="serverless-instrumentation-tags-v1-ErrorTags"></a>

### ErrorTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The Error Name |
| message | [string](#string) | optional | The Error Message - Depending on runtime this is defined or not. |
| stacktrace | [string](#string) | optional | The Error stacktrace if applicable |
| type | [ErrorTags.ErrorType](#serverless-instrumentation-tags-v1-ErrorTags-ErrorType) |  |  |





 


<a name="serverless-instrumentation-tags-v1-ErrorTags-ErrorType"></a>

### ErrorTags.ErrorType


| Name | Number | Description |
| ---- | ------ | ----------- |
| ERROR_TYPE_UNSPECIFIED | 0 | No ErrorType was provided. This should never be the case and if it is received ingest will ignore it. |
| ERROR_TYPE_UNCAUGHT | 1 | An unexpected error that caused the application to fail |
| ERROR_TYPE_CAUGHT | 2 | An error that was reported via the Serverless SDK. Error that doesn&#39;t explicitly fail the application. Multiple errors of this type can be reported during a single application run |


 

 

 



<a name="serverless_instrumentation_tags_v1_tags-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/tags.proto



<a name="serverless-instrumentation-tags-v1-SdkTags"></a>

### SdkTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The Name of the Serverless SDK used to instrument. |
| version | [string](#string) |  | The version of the Serverless SDK used to instrument. |






<a name="serverless-instrumentation-tags-v1-SlsTags"></a>

### SlsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| org_id | [string](#string) |  | A Serverless Platform OrgId. |
| platform | [string](#string) | optional | The platform that was instrumented. Currently Lambda is the only supported platform. |
| service | [string](#string) |  | The service that was instrumented. For Lambda this will be the function name by default. |
| region | [string](#string) | optional | The region that instrumentation was performed in. This is used to determine which Serverless Ingest API to use. |
| sdk | [SdkTags](#serverless-instrumentation-tags-v1-SdkTags) |  |  |
| environment | [string](#string) | optional | An optional environment that can be attached. If there is an applicable environment tag this will be attached in a data enrichment process during ingestion. |
| namespace | [string](#string) | optional | An optional namespace that can be attached. If there is an applicable namespace tag this will be attached in a data enrichment process during ingestion. |






<a name="serverless-instrumentation-tags-v1-Tags"></a>

### Tags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| aws | [AwsTags](#serverless-instrumentation-tags-v1-AwsTags) | optional | These tags are used an AWS resource/sdk is the producer of the span |
| http | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | These tags are used when an http library is making an http request |
| https | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | These tags are used when an http library is making a https request |
| sdk | [SdkTags](#serverless-instrumentation-tags-v1-SdkTags) | optional | These sdk tags are added at ingest time so we know where the data was generated from |
| environment | [string](#string) | optional | Environment is added to all schemas during ingest as part of our data enrichment process |
| namespace | [string](#string) | optional | Namespace is added to all schemas during ingest as part of our data enrichment process |
| org_id | [string](#string) | optional | OrgId is added to all schemas during ingest as part of our data enrichment process |
| error | [ErrorTags](#serverless-instrumentation-tags-v1-ErrorTags) | optional | These tags are used when an event has occured and is reported on the event. |





 

 

 

 



<a name="serverless_instrumentation_v1_dev_mode-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/dev_mode.proto



<a name="serverless-instrumentation-v1-DevModePayload"></a>

### DevModePayload
A DevMode Payload is a message that will contain reqRes data or span data
that is forwarded to ingest via the internal extension


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| account_id | [string](#string) |  | The AWS Account ID where this payload originated from |
| region | [string](#string) |  | The AWS Region where this payload originated from |
| request_id | [string](#string) |  | The lambda request id where this payload originated from |
| telemetry | [LambdaTelemetry](#serverless-instrumentation-v1-LambdaTelemetry) | optional | Extracted Lambda Telemetry API data |
| trace | [TracePayload](#serverless-instrumentation-v1-TracePayload) |  | The set of lambda traces that were generated via an internal extension |
| request_response | [RequestResponse](#serverless-instrumentation-v1-RequestResponse) |  | The req or response data from the instrumented lambda function |






<a name="serverless-instrumentation-v1-LambdaTelemetry"></a>

### LambdaTelemetry
Lambda Telemetry API data. This data is only available for lambda functions that
have access to the telemetry API so it will not be included in all regions.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| init_duration_ms | [uint32](#uint32) | optional | Init duration in milliseconds as reported by the metrics on the platform.initReport event |
| runtime_duration_ms | [uint32](#uint32) | optional | Internal runtime duration in milliseconds as reported by the metrics on the platform.runtimeDone event |
| runtime_response_latency_ms | [uint32](#uint32) | optional | Internal runtime duration in milliseconds as reported by the responseLatency span on the platform.runtimeDone event |





 

 

 

 



<a name="serverless_instrumentation_v1_event-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/event.proto



<a name="serverless-instrumentation-v1-Event"></a>

### Event



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [bytes](#bytes) |  | The Event ID, this will be a random 8-byte ID encoded as a length 16 lowercase hex string. |
| trace_id | [bytes](#bytes) |  | The Trace ID, this will be a random 16-byte ID encoded as a length 32 lowercase hex string. The Trace ID is what is used to group all spans for specific trace together. |
| span_id | [bytes](#bytes) | optional | An optional Span ID to be used to create to show the span context that the event was generated in. In practical terms, every span except the root span will have a parent span ID. |
| timestamp_unix_nano | [fixed64](#fixed64) |  | The timestamp of when the Event happened in nanoseconds from EPOCH. |
| event_name | [string](#string) |  | The name that is used internal in the Serverless platform to identify the event. |
| custom_tags | [string](#string) | optional | The optional customTags that can be attached to an event when published. This is expected to be a JSON object in string format. |
| tags | [serverless.instrumentation.tags.v1.Tags](#serverless-instrumentation-tags-v1-Tags) |  | A message containing any number of Tagsets. |






<a name="serverless-instrumentation-v1-EventPayload"></a>

### EventPayload
An EventPayload is a message that will contain any number
of Events plus the global tags required by our Serverless Ingest Platform.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| sls_tags | [serverless.instrumentation.tags.v1.SlsTags](#serverless-instrumentation-tags-v1-SlsTags) |  |  |
| events | [Event](#serverless-instrumentation-v1-Event) | repeated | A list of Events to be ingested. Ingest does not impose a limit on the number of Events in a single payload. It is the responsibility of the Event producer to limit the size of payloads based on their own requirements. |





 

 

 

 



<a name="serverless_instrumentation_v1_log-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/log.proto



<a name="serverless-instrumentation-v1-LogEvent"></a>

### LogEvent



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| timestamp | [fixed64](#fixed64) |  | The timestamp of when the LogEvent was created. |
| trace_id | [string](#string) | optional | The Trace Id that the log&#39;s are linked to. When ingesting LogEvents, ingest will attempt to infer the request_id from the payload and attach it. If it is not able to, then it will attempt to reconcile later. |
| body | [string](#string) |  | The LogEvent&#39;s body. |
| severity_text | [string](#string) |  | The calculated severity text value for a log |
| severity_number | [uint64](#uint64) |  | The calculated severity text value for a log |
| tags | [serverless.instrumentation.tags.v1.Tags](#serverless-instrumentation-tags-v1-Tags) | optional | A message containing any number of Tagsets |
| is_historical | [bool](#bool) | optional | Is historical is addedd via ingestion so that we can tell the differnce between historical payloads and live streamed payloads |
| type | [string](#string) | optional | Type is used to determine the kind of document that is being send via a livestream |






<a name="serverless-instrumentation-v1-LogPayload"></a>

### LogPayload
A LogPayload is a message that will contain any number of
LogEvents plus the global tags required by our Serverless Ingest Platform.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| sls_tags | [serverless.instrumentation.tags.v1.SlsTags](#serverless-instrumentation-tags-v1-SlsTags) |  |  |
| log_events | [LogEvent](#serverless-instrumentation-v1-LogEvent) | repeated | A list of LogEvents to be ingested. Ingest does not impose a limit on the number of LogEvents in a single payload. It is the responsibility of the LogEvents&#39; producers to limit the size of payloads based on their own requirements. |





 

 

 

 



<a name="serverless_instrumentation_v1_metric-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/metric.proto



<a name="serverless-instrumentation-v1-Metric"></a>

### Metric



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [bytes](#bytes) |  | A unique id for the metric measurement. If this is a Metric from, The metric stream then it will be a randomly generated UUID at ingest time. |
| name | [string](#string) |  | The name of the metric. If this is a Metric from the Metric stream, it will be in the format amazonaws.com/&lt;metric_namespace&gt;/&lt;metric_name&gt;. The name is what will be mapped into influx. |
| start_time_unix_nano | [fixed64](#fixed64) |  | The start time of the measure. If this is a Metric from the Metric stream, it will be the Cloudwatch startTime property. |
| end_time_unix_nano | [fixed64](#fixed64) |  | The end time of the measure. If this is a Metric from the Metric stream, it will be the Cloudwatch endTime property. |
| tags | [string](#string) |  | Tags for the Metric. Any tags can be placed in this field, however, ingest will only write allowlisted, low cardinality tags to Influx. |
| count | [fixed64](#fixed64) |  | The number of datapoints for the Metric. If this is a Metric from the Metric stream, it will be the SampleCount from Cloudwatch |
| sum | [double](#double) |  | The sum of the datapoints for the Metric. |
| quantile_values | [Metric.ValueAtQuantile](#serverless-instrumentation-v1-Metric-ValueAtQuantile) | repeated | List of quantile values. If this is a Metric from the Metric stream, it will by default have quantile 0.0 and 1.0 to represent the min and max values. If defined during Metric&#39;s Stream setup it will have additional quantiles as well. |






<a name="serverless-instrumentation-v1-Metric-ValueAtQuantile"></a>

### Metric.ValueAtQuantile
A value at a given quantile of the distribution.
If a Metric has multiple samples, the Min and Max will be represented by,
1. Quantile = 1.0, is the max value
2. Quantile = 0.0, is the min value


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| quantile | [double](#double) |  |  |
| value | [double](#double) |  |  |






<a name="serverless-instrumentation-v1-MetricPayload"></a>

### MetricPayload
A MetricPayload is a message that will contain any number of
Metrics plus the global tags required by our Serverless Ingest Platform.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| sls_tags | [serverless.instrumentation.tags.v1.SlsTags](#serverless-instrumentation-tags-v1-SlsTags) |  |  |
| metrics | [Metric](#serverless-instrumentation-v1-Metric) | repeated | A list of Metrics to be ingested. Ingest does not impose a limit on the number of Metrics in a single payload. It is the responsibility of the metrics&#39; producers to limit the size of payloads based on their own requirements. |





 

 

 

 



<a name="serverless_instrumentation_v1_request_response-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/request_response.proto



<a name="serverless-instrumentation-v1-RequestResponse"></a>

### RequestResponse
RequestResponse is the AWS Lambda Event and Response Data.
In the Serverless Platform there will be two of these payloads
One for Event payload and then one for the payload returned at the end of
the function invocation.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| sls_tags | [serverless.instrumentation.tags.v1.SlsTags](#serverless-instrumentation-tags-v1-SlsTags) |  | The Global Serverless Platform Tags |
| trace_id | [bytes](#bytes) | optional | The trace Id of the invocation |
| span_id | [bytes](#bytes) | optional | The span id of the root Lambda Span that request data is attached to on ingest. |
| request_id | [string](#string) | optional | The Lambda Request Id. |
| body | [string](#string) | optional | JSON string of the request or the response body In case of response may be omited if lambda resolved with no value |
| origin | [RequestResponse.Origin](#serverless-instrumentation-v1-RequestResponse-Origin) |  | Type of body |
| tags | [serverless.instrumentation.tags.v1.Tags](#serverless-instrumentation-tags-v1-Tags) | optional | A message containing any number of Tagsets |
| is_historical | [bool](#bool) | optional | Is historical is addedd via ingestion so that we can tell the differnce between historical payloads and live streamed payloads |
| type | [string](#string) | optional | Type is used to determine the kind of document that is being send via a livestream |
| timestamp | [fixed64](#fixed64) | optional | The timestamp of when the req/res data was generated. |





 


<a name="serverless-instrumentation-v1-RequestResponse-Origin"></a>

### RequestResponse.Origin


| Name | Number | Description |
| ---- | ------ | ----------- |
| ORIGIN_UNSPECIFIED | 0 | Not disclosed (not applicable as property is required) |
| ORIGIN_REQUEST | 1 | Function request event |
| ORIGIN_RESPONSE | 2 | Function handler response |


 

 

 



<a name="serverless_instrumentation_v1_trace-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/trace.proto



<a name="serverless-instrumentation-v1-Span"></a>

### Span



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [bytes](#bytes) |  | The Span ID, this will be a random 8-byte ID encoded as a length 16 lowercase hex string. |
| trace_id | [bytes](#bytes) |  | The Trace ID, this will be a random 16-byte ID encoded as a length 32 lowercase hex string. The Trace ID is what is used to group all spans for specific trace together. |
| parent_span_id | [bytes](#bytes) | optional | An optional Parent Span ID to be used to create a trace&#39;s Span Dependency graph. In practical terms, every span except the root span will have a parent span ID. |
| name | [string](#string) |  | The name of the span describes the type of span that is being produced. currently have a limited set of span names

- aws.lambda: Spans the full invocation duration of a lambda function - aws.lambda.invocation: Spans the cold-start duration of a lambda function |
| start_time_unix_nano | [fixed64](#fixed64) |  | The start time of the span in nanoseconds from EPOCH. |
| end_time_unix_nano | [fixed64](#fixed64) |  | The end time of the span in nanoseconds from EPOCH. An important invariant to keep in mind is that the root span will always have the latest end time. |
| tags | [serverless.instrumentation.tags.v1.Tags](#serverless-instrumentation-tags-v1-Tags) |  | A message containing any number of Tagsets |
| input | [string](#string) | optional | Eventual input body (e.g. HTTP request body) |
| output | [string](#string) | optional | Eventual output body (e.g. HTTP response body) |
| timestamp | [fixed64](#fixed64) | optional | The timestamp that is created in ingestion as the search key |
| is_historical | [bool](#bool) | optional | Is historical is addedd via ingestion so that we can tell the differnce between historical payloads and live streamed payloads |
| type | [string](#string) | optional | Type is used to determine the kind of document that is being send via a livestream |






<a name="serverless-instrumentation-v1-TracePayload"></a>

### TracePayload
ATracePayload is a message that will contain any number
of Spans plus the global tags required by our Serverless Ingest
Platform. A TracePayload DOES NOT necessarily mean that it is a
complete Trace. It may contain only a subset of Spans that
will make up the complete Trace.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| sls_tags | [serverless.instrumentation.tags.v1.SlsTags](#serverless-instrumentation-tags-v1-SlsTags) |  |  |
| spans | [Span](#serverless-instrumentation-v1-Span) | repeated | A list of Spans to be ingest. Ingest does not impose a limit on the number of Spans in a single payload. It is the responsibility of the Span producers to limit the size of payloads based on their own requirements. |





 

 

 

 



## Scalar Value Types

| .proto Type | Notes | C++ | Java | Python | Go | C# | PHP | Ruby |
| ----------- | ----- | --- | ---- | ------ | -- | -- | --- | ---- |
| <a name="double" /> double |  | double | double | float | float64 | double | float | Float |
| <a name="float" /> float |  | float | float | float | float32 | float | float | Float |
| <a name="int32" /> int32 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint32 instead. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="int64" /> int64 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint64 instead. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="uint32" /> uint32 | Uses variable-length encoding. | uint32 | int | int/long | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="uint64" /> uint64 | Uses variable-length encoding. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum or Fixnum (as required) |
| <a name="sint32" /> sint32 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int32s. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sint64" /> sint64 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int64s. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="fixed32" /> fixed32 | Always four bytes. More efficient than uint32 if values are often greater than 2^28. | uint32 | int | int | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="fixed64" /> fixed64 | Always eight bytes. More efficient than uint64 if values are often greater than 2^56. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum |
| <a name="sfixed32" /> sfixed32 | Always four bytes. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sfixed64" /> sfixed64 | Always eight bytes. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="bool" /> bool |  | bool | boolean | boolean | bool | bool | boolean | TrueClass/FalseClass |
| <a name="string" /> string | A string must always contain UTF-8 encoded or 7-bit ASCII text. | string | String | str/unicode | string | string | string | String (UTF-8) |
| <a name="bytes" /> bytes | May contain any arbitrary sequence of bytes. | string | ByteString | str | []byte | ByteString | string | String (ASCII-8BIT) |

