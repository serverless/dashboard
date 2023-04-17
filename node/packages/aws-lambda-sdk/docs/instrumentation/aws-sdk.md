# AWS SDK instrumentation

_Disable with `SLS_DISABLE_AWS_SDK_MONITORING` environment variable_

All AWS SDK requests are traced.

Tracing is turned on automatically for AWS SDK clients that are normally loaded via Node.js `require`.

However if AWS SDK is bundled then instrumentation needs to be turned on manually with following steps:

```javascript
import AWS from 'aws-sdk';

// Instrument AWS SDK v2:
serverlessSdk.instrumentation.awsSdkV2.install(AWS);

import { Lambda } from '@aws/client-lambda';
const lambda = new Lambda({ region: process.env.AWS_REGION });

// Instrument AWS SDK v3 Client
serverlessSdk.instrumentation.awsSdkV3Client.install(lambda);
```

Covered AWS SDK requests are reflected in `aws.sdk.<service-name>` spans

## Base span tags

Tags that apply to all AWS SDK requests:

| Name                        | Value                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `aws.sdk.region`            | Region to which request is made                                                        |
| `aws.sdk.signature_version` | Signature version of request authentication (for latest versions of SDK it'll be "v4") |
| `aws.sdk.service`           | Service to which request is made                                                       |
| `aws.sdk.operation`         | Operation name (e.g. `listtopics`)                                                     |
| `aws.sdk.request_id`        | AWS reqeust id                                                                         |
| `aws.sdk.error`             | If request ends with error, the error message                                          |

## `aws.sdk.sns` span tags

Tags that apply to requests that go to SNS service

| Name                      | Value                    |
| ------------------------- | ------------------------ |
| `aws.sdk.sns.topic_name`  | Topic name               |
| `aws.sdk.sns.message_ids` | Ids of affected messages |

## `aws.sdk.sqs` span tags

Tags that apply to requests that go to SQS service

| Name                      | Value                    |
| ------------------------- | ------------------------ |
| `aws.sdk.sqs.queue_name`  | Queue name               |
| `aws.sdk.sqs.message_ids` | Ids of affected messages |

## `aws.sdk.dynamodb` span tags

Tags that apply to requests that go to DynamoDb service

| Name                                 | Value                                                       |
| ------------------------------------ | ----------------------------------------------------------- |
| `aws.sdk.dynamodb.table_name`        | Affected table name                                         |
| `aws.sdk.dynamodb.consistent_read`   | The value of the `ConsistentRead` request parameter         |
| `aws.sdk.dynamodb.limit`             | The value of the `Limit` request parameter                  |
| `aws.sdk.dynamodb.attributes_to_get` | The value of the `AttributesToGet` request parameter        |
| `aws.sdk.dynamodb.projection`        | The value of the `ProjectionExpression` request parameter   |
| `aws.sdk.dynamodb.index_name`        | The value of the `IndexName` request parameter              |
| `aws.sdk.dynamodb.scan_forward`      | The value of the `ScanIndexForward` request parameter       |
| `aws.sdk.dynamodb.select`            | The value of the `Select` request parameter                 |
| `aws.sdk.dynamodb.filter`            | The value of the `FilterExpression` request parameter       |
| `aws.sdk.dynamodb.key_condition`     | The value of the `KeyConditionExpression` request parameter |
| `aws.sdk.dynamodb.segment`           | The value of the `Segment` request parameter                |
| `aws.sdk.dynamodb.total_segments`    | The value of the `TotalSegments` request parameter          |
| `aws.sdk.dynamodb.count`             | The value of the `Count` response parameter                 |
| `aws.sdk.dynamodb.scanned_count`     | The value of the `ScannedCount` response parameter          |

## Request and response data

In developer mode, additionally request and response bodies are monitored. That can be disabled with `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` environment variable
