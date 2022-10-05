# AWS Lambda SDK internal flow monitoring

## Request and response data

_DIsable with `SLS_DISABLE_REQUEST_MONITORING` and `SLS_DISABLE_RESPONSE_MONITORING` environment variables respectively_

SDK reads and writes to logs request (lambda event) and response data. This data is written with a log line looking as:

```
SERVERLESS_TELEMETRY.R.<base64 encoded payload>
```

## HTTP(S) requests

_Disable with `SLS_DISABLE_HTTP_MONITORING` environment variable_

All HTTP and HTTPS requests are monitored and stored as `node.http.request` & `node.https.request` trace spans

#### Trace span tags:

| Name                         | Value                                            |
| ---------------------------- | ------------------------------------------------ |
| `http.method`                | Request method (e.g. `GET`)                      |
| `http.protocol`              | Currently `HTTP/1.1` in all cases                |
| `http.host`                  | Domain name and port name if custom              |
| `http.path`                  | Request pathname (query string is not included)  |
| `http.query_parameter_names` | Query string parameter names (if provided)       |
| `http.request_header_names`  | Request header names                             |
| `http.status_code`           | Response status code                             |
| `http.error_code`            | If request errored, its error code               |
| `http.request_body`          | _(dev mode only)_ Request body (if UTF8 string)  |
| `http.response_body`         | _(dev mode only)_ Response body (if UTF8 string) |

## AWS SDK requests

_Disable with `SLS_DISABLE_AWS_SDK_MONITORING` environment variable_

All AWS SDK requests are traced.

Tracing is turned on automatically for AWS SDK clients that are normally loaded via Node.js `require`.

However if AWS SDK is bundled or imported via ESM import, then instrumentation needs to be turned on manually with following steps:

```javascript
import AWS from 'aws-sdk';

// Instrument AWS SDK v2:
serverlessSdk.instrument.awsSdkV2(AWS);

import { Lambda } from '@aws/client-lambda';
const lambda = new Lambda({ region: process.env.AWS_REGION });

// Instrument AWS SDK v3 Client
serverlessSdk.instrument.awsSdkV3Client(lambda);
```

Covered AWS SDK requests are reflected in `aws.sdk.<service-name>` spans

#### Base span tags

Tags that apply to all AWS SDK requests:

| Name                        | Value                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `aws.sdk.region`            | Region to which request is made                                                        |
| `aws.sdk.signature_version` | Signature version of request authentication (for latest versions of SDK it'll be "v4") |
| `aws.sdk.service`           | Service to which request is made                                                       |
| `aws.sdk.operation`         | Operation name (e.g. `listtopics`)                                                     |
| `aws.sdk.request_id`        | AWS reqeust id                                                                         |
| `aws.sdk.error`             | If request ends with error, the error message                                          |
| `aws.sdk.request_body`      | _(dev mode only)_ Request body                                                         |
| `aws.sdk.response_body`     | _(dev mode only)_ Response body                                                        |

#### `aws.sdk.sns` span tags`

Tags that apply to requests that go to SNS service

| Name                      | Value                    |
| ------------------------- | ------------------------ |
| `aws.sdk.sns.topic_name`  | Topic name               |
| `aws.sdk.sns.message_ids` | Ids of affected messages |

#### `aws.sdk.sqs` span tags`

Tags that apply to requests that go to SQS service

| Name                      | Value                    |
| ------------------------- | ------------------------ |
| `aws.sdk.sqs.queue_name`  | Queue name               |
| `aws.sdk.sqs.message_ids` | Ids of affected messages |

#### `aws.sdk.dynamodb` span tags`

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

## express middlewares

_Disable with `SLS_DISABLE_EXPRESS_MONITORING` environment variable_

If [`express`](https://expressjs.com/) framework (together with tools like [`serverless-http`](https://github.com/dougmoscrop/serverless-http)) is used to route incoming requests. Trace sans for it's middlewares are created

Tracing is turned on automatically, assuming that `express` is loaded normally via Node.js `require`.
If it comes bundled or imported via ESM import, then instrumentation needs to be turned on manually with following steps:

```javascript
import express from 'express';

const app = express();

serverlessSdk.instrument.expressApp(express);
```

Handling of express route is covered in context of main `express` span. Additionally middleware jobs are recorded as following spans:

- `express.middleware.<name>`, generic middleware (setup via `app.use`)
- `express.middlewa.route.<method>.<name>` - route specific middleware (setup via `app.get`, `app.post` etc.)
- `express.middleware.error.<name>` - error handling middleware

#### Tags introduced on `aws.lambda` span

| Name                          | Value                 |
| ----------------------------- | --------------------- |
| `aws.lambda.http_router.path` | Middleware route path |
