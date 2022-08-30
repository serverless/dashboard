# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [serverless/instrumentation/tags/v1/aws.proto](#serverless_instrumentation_tags_v1_aws-proto)
    - [AwsApiGatewayTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags)
    - [AwsApiGatewayTags.AwsApiGatewayRequestTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags-AwsApiGatewayRequestTags)
    - [AwsLambdaInitializationTags](#serverless-instrumentation-tags-v1-AwsLambdaInitializationTags)
    - [AwsLambdaInvocationTags](#serverless-instrumentation-tags-v1-AwsLambdaInvocationTags)
    - [AwsLambdaTags](#serverless-instrumentation-tags-v1-AwsLambdaTags)
    - [AwsSdkBaseTags](#serverless-instrumentation-tags-v1-AwsSdkBaseTags)
    - [AwsSdkDynamodbTags](#serverless-instrumentation-tags-v1-AwsSdkDynamodbTags)
    - [AwsSdkSnsTags](#serverless-instrumentation-tags-v1-AwsSdkSnsTags)
    - [AwsSdkSqsTags](#serverless-instrumentation-tags-v1-AwsSdkSqsTags)
    - [AwsSdkTags](#serverless-instrumentation-tags-v1-AwsSdkTags)
    - [AwsSnsEventTags](#serverless-instrumentation-tags-v1-AwsSnsEventTags)
    - [AwsSqsEventTags](#serverless-instrumentation-tags-v1-AwsSqsEventTags)
    - [AwsTags](#serverless-instrumentation-tags-v1-AwsTags)
  
    - [AwsLambdaTags.Outcome](#serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome)
  
- [serverless/instrumentation/tags/v1/common.proto](#serverless_instrumentation_tags_v1_common-proto)
    - [HttpTags](#serverless-instrumentation-tags-v1-HttpTags)
  
- [serverless/instrumentation/tags/v1/nodejs.proto](#serverless_instrumentation_tags_v1_nodejs-proto)
    - [ExpressTags](#serverless-instrumentation-tags-v1-ExpressTags)
  
- [serverless/instrumentation/tags/v1/tags.proto](#serverless_instrumentation_tags_v1_tags-proto)
    - [SlsTags](#serverless-instrumentation-tags-v1-SlsTags)
    - [SlsTags.SdkTags](#serverless-instrumentation-tags-v1-SlsTags-SdkTags)
    - [Tags](#serverless-instrumentation-tags-v1-Tags)
  
- [serverless/instrumentation/v1/log.proto](#serverless_instrumentation_v1_log-proto)
    - [LogEvent](#serverless-instrumentation-v1-LogEvent)
    - [LogPayload](#serverless-instrumentation-v1-LogPayload)
  
- [serverless/instrumentation/v1/metric.proto](#serverless_instrumentation_v1_metric-proto)
    - [Metric](#serverless-instrumentation-v1-Metric)
    - [Metric.ValueAtQuantile](#serverless-instrumentation-v1-Metric-ValueAtQuantile)
    - [MetricPayload](#serverless-instrumentation-v1-MetricPayload)
  
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
| time_epoch | [fixed64](#fixed64) |  | The request time in milliseconds from epoch. |
| protocol | [string](#string) |  | The HTTP protocol of the request. |
| domain | [string](#string) |  | The domain name of the request. |
| headers | [string](#string) |  | JSON string containing Request Headers |
| method | [string](#string) |  | The HTTP method of the request. |
| path | [string](#string) |  | The HTTP Path of the request. |
| path_parameters | [string](#string) | optional | JSON string containing Request Path Parameters |
| string_parameters | [string](#string) | optional | JSON string contain Query String Parameters |






<a name="serverless-instrumentation-tags-v1-AwsLambdaInitializationTags"></a>

### AwsLambdaInitializationTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| initialization_duration | [fixed64](#fixed64) |  | The Initialization Duration of the Lambda Function. This is one part of the billed duration. Maps to the Cloudwatch Logs Report &#34;Init Duration&#34; |






<a name="serverless-instrumentation-tags-v1-AwsLambdaInvocationTags"></a>

### AwsLambdaInvocationTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| invocation_duration | [fixed64](#fixed64) |  | The Invocation Duration of the Lambda Function. This is one part of the billed duration. Maps to the Cloudwatch Logs Report &#34;Duration&#34; |






<a name="serverless-instrumentation-tags-v1-AwsLambdaTags"></a>

### AwsLambdaTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| arch | [string](#string) |  | The architecture of the Lambda function, currently either amd64 or arm64. |
| is_coldstart | [bool](#bool) |  | Was the invocation a cold start? |
| event_type | [string](#string) |  | The event type for the invocation. |
| event_source | [string](#string) |  | The event source for the invocation. |
| log_group | [string](#string) |  | The Log Group for the Lambda Function. |
| log_stream_name | [string](#string) |  | The Log Stream for the invocation. |
| max_memory | [fixed64](#fixed64) |  | The Max Memory that is configured for the Lambda Function. |
| name | [string](#string) |  | The Lambda Function name. |
| request_id | [string](#string) |  | The Request ID for the invocation. |
| version | [string](#string) |  | The Lambda Function version. |
| outcome | [AwsLambdaTags.Outcome](#serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome) |  | The Outcome of the Lambda invocation |
| error_exception_message | [string](#string) | optional | Optional error exception message. |
| error_exception_stacktrace | [string](#string) | optional | Optional error exception stacktrace. |
| duration | [fixed64](#fixed64) | optional | The billed duration of the invocation in milliseconds. This will not be available when instrumented, this will be upserted into this tag set after the report log from Cloudwatch is available.

Optional Event Tags are from 100 on |
| sqs | [AwsSqsEventTags](#serverless-instrumentation-tags-v1-AwsSqsEventTags) | optional | Will be set if the function is handling a SQS event |
| sns | [AwsSnsEventTags](#serverless-instrumentation-tags-v1-AwsSnsEventTags) | optional | Will be set if the function is handling a SNS event |
| http | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | Will be set if the function is handling HTTP requests via any method, API GW, Function URLs, etc. |
| api_gateway | [AwsApiGatewayTags](#serverless-instrumentation-tags-v1-AwsApiGatewayTags) | optional | Will be set if the function is handling HTTP requests via AWS API GW |
| initialization | [AwsLambdaInitializationTags](#serverless-instrumentation-tags-v1-AwsLambdaInitializationTags) | optional | The root AWS Lambda Span tags. |
| invocation | [AwsLambdaInvocationTags](#serverless-instrumentation-tags-v1-AwsLambdaInvocationTags) | optional | The AWS Lambda Invocation tags. |






<a name="serverless-instrumentation-tags-v1-AwsSdkBaseTags"></a>

### AwsSdkBaseTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| account_id | [string](#string) |  | The AWS Account Id this SDK call is being made against. |
| region | [string](#string) |  | The AWS Region this SDK call is being made against. |
| signature_version | [string](#string) |  | AWS Authentication signature version of the request. |
| aws_service | [string](#string) |  | The name of the service to which a request is made. |
| operation | [string](#string) |  | The name of the operation corresponding to the request. |
| request_id | [string](#string) |  | The unique ID of the request. |
| error | [string](#string) | optional | An optional error returned from the AWS APIs. |






<a name="serverless-instrumentation-tags-v1-AwsSdkDynamodbTags"></a>

### AwsSdkDynamodbTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| aws_sdk_tags | [AwsSdkBaseTags](#serverless-instrumentation-tags-v1-AwsSdkBaseTags) |  | The AWS SDK base tags that all instrumented AWS SDK calls have. |
| operation | [string](#string) |  | The Dynamodb operation that was performed. Ex. GetItem, PutItem, Query, etc. |
| table_names | [string](#string) | repeated | The DynamoDB table name or names that the operation was performed on. |
| projection | [string](#string) | optional | The value of the ProjectionExpression request parameter. |
| scan_forward | [bool](#bool) | optional | The value of the ScanIndexForward request parameter. |
| attributes_to_get | [string](#string) | repeated | The value of the AttributesToGet request parameter. |
| consistent_read | [bool](#bool) | optional | The value of the ConsistentRead request parameter. |
| index_name | [string](#string) | optional | The value of the IndexName request parameter. |
| limit | [uint32](#uint32) | optional | The value of the Limit request parameter. |
| select | [string](#string) | optional | The value of the Select request parameter. |
| segment | [uint32](#uint32) | optional | The value of the Segment request parameter. |
| total_segments | [uint64](#uint64) | optional | The value of the TotalSegments request parameter. |
| count | [uint64](#uint64) | optional | The value of the Count response parameter. |
| scanned_count | [uint64](#uint64) | optional | The value of the ScannedCount response parameter. |






<a name="serverless-instrumentation-tags-v1-AwsSdkSnsTags"></a>

### AwsSdkSnsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| aws_sdk_tags | [AwsSdkBaseTags](#serverless-instrumentation-tags-v1-AwsSdkBaseTags) |  | The AWS SDK base tags that all instrumented AWS SDK calls have. |
| topic_name | [string](#string) | optional | The SNS Topic ARN, from the TopicArn request parameter. |
| operation | [string](#string) | optional | The SNS Operation that was performed. |
| message_ids | [string](#string) | repeated | The message IDs provided in the SDK operation response. |






<a name="serverless-instrumentation-tags-v1-AwsSdkSqsTags"></a>

### AwsSdkSqsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| aws_sdk_tags | [AwsSdkBaseTags](#serverless-instrumentation-tags-v1-AwsSdkBaseTags) |  | The AWS SDK base tags that all instrumented AWS SDK calls have. |
| queue_name | [string](#string) | optional | The SQS queue URL. |
| message_ids | [string](#string) | repeated | The message IDs provided in the SDK operation response. |
| operation | [string](#string) | optional | The SQS Operation that was performed. |






<a name="serverless-instrumentation-tags-v1-AwsSdkTags"></a>

### AwsSdkTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dynamodb | [AwsSdkDynamodbTags](#serverless-instrumentation-tags-v1-AwsSdkDynamodbTags) | optional |  |
| sqs | [AwsSdkSqsTags](#serverless-instrumentation-tags-v1-AwsSdkSqsTags) | optional |  |
| sns | [AwsSdkSnsTags](#serverless-instrumentation-tags-v1-AwsSdkSnsTags) | optional |  |






<a name="serverless-instrumentation-tags-v1-AwsSnsEventTags"></a>

### AwsSnsEventTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| topic_name | [string](#string) |  | Taken from the TopicARN |
| operation | [string](#string) |  | The operation of the SNS Event Trigger. Will always be &#39;receive&#39; currently |
| message_ids | [string](#string) | repeated | Introspected from the events records |






<a name="serverless-instrumentation-tags-v1-AwsSqsEventTags"></a>

### AwsSqsEventTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| queue_name | [string](#string) |  | Taken from the eventSourceARN |
| operation | [string](#string) |  | The operation of the SQS Event Trigger. Will always be &#39;receive&#39; currently |
| message_ids | [string](#string) | repeated | Introspected from the events records |






<a name="serverless-instrumentation-tags-v1-AwsTags"></a>

### AwsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| lambda | [AwsLambdaTags](#serverless-instrumentation-tags-v1-AwsLambdaTags) | optional | The root AWS Lambda Span tags |
| sdk | [AwsSdkTags](#serverless-instrumentation-tags-v1-AwsSdkTags) | optional | The AWS SDK Tags |





 


<a name="serverless-instrumentation-tags-v1-AwsLambdaTags-Outcome"></a>

### AwsLambdaTags.Outcome
A Lambda function invocation can have one of the following
outcomes upon completion.

| Name | Number | Description |
| ---- | ------ | ----------- |
| OUTCOME_UNSPECIFIED | 0 |  |
| OUTCOME_SUCCESS | 1 |  |
| OUTCOME_ERROR_INITIALIZATION | 2 |  |
| OUTCOME_ERROR_UNHANDLED | 3 |  |
| OUTCOME_ERROR_TIMEOUT | 4 |  |
| OUTCOME_ERROR_HANDLED | 5 |  |


 

 

 



<a name="serverless_instrumentation_tags_v1_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/common.proto



<a name="serverless-instrumentation-tags-v1-HttpTags"></a>

### HttpTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| path | [string](#string) |  | The Path of the incoming HTTP Request Event. Depending on the event type, the path may come from API Gateway or a routing library&#39;s, like express, instrumentation. |
| method | [string](#string) |  | The method of the incoming HTTP Request Event. |
| protocol | [string](#string) |  | The HTTP protocol of the incoming HTTP Request Event. |
| status_code | [fixed64](#fixed64) |  | The Response Status Code. |





 

 

 

 



<a name="serverless_instrumentation_tags_v1_nodejs-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/nodejs.proto



<a name="serverless-instrumentation-tags-v1-ExpressTags"></a>

### ExpressTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| method | [string](#string) |  | The HTTP method defined by the Express Route Handler. |
| path | [string](#string) |  | The HTTP Path defined by the Express Route Handler. |
| status_code | [uint32](#uint32) |  | The status code returned by the Express Route Handler. |





 

 

 

 



<a name="serverless_instrumentation_tags_v1_tags-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/tags/v1/tags.proto



<a name="serverless-instrumentation-tags-v1-SlsTags"></a>

### SlsTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| org_id | [string](#string) |  | A Serverless Platform OrgId. |
| platform | [string](#string) |  | The platform that was instrumented. Currently Lambda is the only supported platform. |
| service | [string](#string) |  | The service that was instrumented. For Lambda this will be the function name by default. |
| region | [string](#string) |  | The region that instrumentation was performed in. This is used to determine which Serverless Ingest API to use. |
| sdk | [SlsTags.SdkTags](#serverless-instrumentation-tags-v1-SlsTags-SdkTags) |  |  |
| environment | [string](#string) | optional | An optional environment that can be attached. |
| namespace | [string](#string) | optional | An optional namespace that can be attached. |






<a name="serverless-instrumentation-tags-v1-SlsTags-SdkTags"></a>

### SlsTags.SdkTags



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The Name of the Serverless SDK used to instrument. |
| version | [string](#string) |  | The version of the Serverless SDK used to instrument. |






<a name="serverless-instrumentation-tags-v1-Tags"></a>

### Tags
============================================ //
Defined TagSets start at field number 100  //
========================================== //


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| aws | [AwsTags](#serverless-instrumentation-tags-v1-AwsTags) | optional | The AWS tags |
| http | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | The HTTP Tags. |
| https | [HttpTags](#serverless-instrumentation-tags-v1-HttpTags) | optional | The HTTPS Tags. |
| express | [ExpressTags](#serverless-instrumentation-tags-v1-ExpressTags) | optional | The Express Tags. |





 

 

 

 



<a name="serverless_instrumentation_v1_log-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## serverless/instrumentation/v1/log.proto



<a name="serverless-instrumentation-v1-LogEvent"></a>

### LogEvent



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  | The LogEvent&#39;s body. |
| timestamp | [fixed64](#fixed64) |  | The timestamp of when the LogEvent was created. |
| sequence_id | [string](#string) |  | The monotonically increasing sequence id for a LogEvent. This is used to determine the ordering of messages in a given stream of logs. If this is a LogEvent coming from Cloudwatch Logs, it will be provided otherwise it is the responsibility of the log producer to generate a sequence id. |
| log_group | [string](#string) | optional | The Cloudwatch Log Group name. |
| log_stream | [string](#string) | optional | The Cloudwatch Log Group Stream id. |
| account_id | [string](#string) | optional | The Owner Account Id of the Cloudwatch Log Group. |
| request_id | [string](#string) | optional | The Lambda request Id that the log&#39;s are linked to. When ingesting LogEvents, ingest will attempt to infer the request_id from the payload and attach it. If it is not able to, then it will attempt to reconcile later. |
| trace_id | [string](#string) | optional | The Trace Id that the log&#39;s are linked to. When ingesting LogEvents, ingest will attempt to infer the request_id from the payload and attach it. If it is not able to, then it will attempt to reconcile later. |






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
| name | [string](#string) |  | The name of the span. |
| start_time_unix_nano | [fixed64](#fixed64) |  | The start time of the span in nanoseconds from EPOCH. |
| end_time_unix_nano | [fixed64](#fixed64) |  | The end time of the span in nanoseconds from EPOCH. An important invariant to keep in mind is that the root span will always have the latest end time. |
| tags | [serverless.instrumentation.tags.v1.Tags](#serverless-instrumentation-tags-v1-Tags) |  | A message containing any number of Tagsets |






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

