# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.15.5](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.15.4...@serverless/sdk-schema@0.15.5) (2023-05-17)

### Features

- Introduce `aws.lambda.response_mode` tag ([e61819e](https://github.com/serverless/console/commit/e61819e57b7b9342ce57c52d0d055ce0b1aa4542))

### [0.15.4](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.15.3...@serverless/sdk-schema@0.15.4) (2023-05-15)

### Features

- Dev Mode transport payload upgrade ([ec7551d](https://github.com/serverless/console/commit/ec7551dac4a167a950a60aa5b322c3c28f50f13d))

### [0.15.3](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.15.2...@serverless/sdk-schema@0.15.3) (2023-03-29)

### Features

- AWS Lambda runtime related tags ([f239b44](https://github.com/serverless/console/commit/f239b442dd8a2d53ee7ea2e75a1b43f5ffc120f8))

### [0.15.2](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.15.1...@serverless/sdk-schema@0.15.2) (2023-03-08)

### Features

- Define `is_sampled_out` for TracePayload ([20c1966](https://github.com/serverless/console/commit/20c1966cb5c00748e766f99bf8f054a32484cd02))

## [0.15.1](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.15.0...@serverless/sdk-schema@0.15.1) (2023-02-09)

### Features

- Notice event tags ([c6641be](https://github.com/serverless/console/commit/c6641beee48b998866ceacd1ff8e317eefdcb057))

## [0.15.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.5...@serverless/sdk-schema@0.15.0) (2023-02-02)

### ⚠ BREAKING CHANGES

- Captured event `WarningType.WARNING_TYPE_SDK` reference is renamed to `WarningType.WARNING_TYPE_SDK_USER`
- Captured event `ErrorType.ERROR_TYPE_CAUGHT` reference is renamed to `ErrorType.ERROR_TYPE_CAUGHT_USER`

### Features

- Distinguish between user or internal SDK generated warning ([27f28f2](https://github.com/serverless/console/commit/27f28f2b8846ba8657d6cf60e9282580874045b8))
- Distinguish user and sdk caught errors ([177516b](https://github.com/serverless/console/commit/177516bf05e59bba1fbd32e09c3d74863cf103f7))

## [0.14.5](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.4...@serverless/sdk-schema@0.14.5) (2023-01-24)

### Features

- Define `WarningTags.stacktrace` ([b04ae2c](https://github.com/serverless/console/commit/b04ae2c7e15058c7bf3f1001931e13000409a920))

### [0.14.4](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.3...@serverless/sdk-schema@0.14.4) (2023-01-18)

### Features

- Define `TracePayload.custom_tags` ([21056f6](https://github.com/serverless/console/commit/21056f60abf3329dac9e364e4a2d8a7e0f318e08))

## [0.14.3](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.2...@serverless/sdk-schema@0.14.3) (2023-01-13)

### Features

- Define `Span.custom_tags` for custom user tags ([38338ee](https://github.com/serverless/console/commit/38338ee6c6dd11a41288220f204c4f738d680a36))

## [0.14.2](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.1...@serverless/sdk-schema@0.14.2) (2023-01-11)

### Features

- `WarningTags.type` ([0cbd622](https://github.com/serverless/console/commit/0cbd622ee357967d1a44b5a546f3c6b70996e88e))
- Define `Event.custom_fingerprint` ([306362a](https://github.com/serverless/console/commit/306362ade4abcc33dcc7e6f4d808e5790822c6ad))

## [0.14.1](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.14.0...@serverless/sdk-schema@0.14.1) (2022-12-23)

### Features

- Add Warning Tags to Event Schema ([#333](https://github.com/serverless/console/issues/333)) ([94c9c5f](https://github.com/serverless/console/commit/94c9c5f91a9ce9378596edff4c4df009cfc9b274))

### [0.14.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.13.2...@serverless/sdk-schema@0.14.0) (2022-12-07)

### ⚠ BREAKING CHANGES

- `tracePayload`: `events` is added as a repeated field

### Features

- Add Events as a property of TracePayload ([aced7ec](https://github.com/serverless/console/commit/aced7ecb10f4dd862d1ed29fbe2717974ed78022))

### [0.13.2](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.13.1...@serverless/sdk-schema@0.13.2) (2022-12-02)

### Features

- Added `Event` and `EventPayload` schemas

## [0.13.1](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.13.0...@serverless/sdk-schema@0.13.1) (2022-11-24)

### Features

- Make `aws.sdk.signature_version` tag optional ([cd566b0](https://github.com/serverless/console/commit/cd566b0f685bc62a1fd74840278fdd9f618c0cb0))

## [0.13.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.12.1...@serverless/sdk-schema@0.13.0) (2022-10-31)

### ⚠ BREAKING CHANGES

- `requestResponse` payload: `data` is removed in favor of `body` and `origin`

### Features

- `requestResponse` payload: Replace `data` with `body` and `origin` ([c1c7b86](https://github.com/serverless/console/commit/c1c7b86a5a4e49de79dadc717d8d31ebafc69602))
- Support Node.js v12 ([bb62fa1](https://github.com/serverless/console/commit/bb62fa1506fdd6a99635fd780e6cbc2d5c58a10f))

### [0.12.1](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.12.0...@serverless/sdk-schema@0.12.1) (2022-10-24)

### Features

- Added timestamp to req/res proto schema ([ce13fd8](https://github.com/serverless/console/commit/ce13fd8c83cd42b9dc708745647be8761c15bc42))

### [0.12.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.11.0...@serverless/sdk-schema@0.11.1) (2022-10-20)

### ⚠ BREAKING CHANGES

- Updated logs schema to support ingest process a bit better ([f217ea2](https://github.com/serverless/console/commit/f217ea24e86352b7d5ac1f877180b8037778bcec))

## [0.11.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.10.1...@serverless/sdk-schema@0.11.0) (2022-10-20)

### ⚠ BREAKING CHANGES

- `http.request_body`, `http.response_body`, `aws.sdk.request_body` and `aws.sdk.response_body` tags are removed in favor of top level `input and `output` properties

### Features

- Move span `input` and `output` data to top level properties ([277b6e9](https://github.com/serverless/console/commit/277b6e9eb3cd5517b83de2f9e4867d4d7f38cb81))

## [0.10.1](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.10.0...@serverless/sdk-schema@0.10.1) (2022-10-04)

### Features

- Configure optional `request_body` and `response_body` tags ([ed44a1c](https://github.com/serverless/console/commit/ed44a1c749fdb990a7e121455a94eef55bfcf41b))

## [0.10.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.9.0...@serverless/sdk-schema@0.10.0) (2022-09-28)

### ⚠ BREAKING CHANGES

- `express` tags namespace is removed in favor of introduced `aws.lambda.http_router`

### Features

- Remove `express` tags in favor of `aws.lambda.http_router` ([ff17ea9](https://github.com/serverless/console/commit/ff17ea95513261115cec7c904457201b0c3032a5))

## [0.9.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.8.0...@serverless/sdk-schema@0.9.0) (2022-09-26)

### ⚠ BREAKING CHANGES

- Remove `aws.lambda.api_gateway.request.path_parameters` in favor of `aws.lambda.api_gateway.request.path_parameter_names`
- Remove `aws.lambda.api_gateway.request.headers` in favor of `http.request_header_names`
- Remove `http.query` in favor of `http.query_parameter_names`
- Change numbering of some `http.*` fields

### Features

- Remove `aws.lambda.api_gateway.request.path_parameters` in favor of `aws.lambda.api_gateway.request.path_parameter_names` ([44702ad](https://github.com/serverless/console/commit/44702adaa08c3676b7e418a4f08e3fe34465abeb))
- Remove `aws.lambda.api_gateway.request.headers` in favor of `http.request_header_names` ([2a38ba4](https://github.com/serverless/console/commit/2a38ba4f3f5db14d82be1f6787bc7444fab33bf9))
- Remove `http.query` in favor of `http.query_parameter_names` ([ee0c8e5](https://github.com/serverless/console/commit/ee0c8e57e0e681951c018700a15ff154d4601e2e))
- Define `exclusive_start_key` and `attribute_values` DynamoDB tags ([d15839d](https://github.com/serverless/console/commit/d15839d3fee231f22fbf956cd8997026cb39b4bc))

### Maintenance Improvements

- Pre-reserve slots for fields eventually to be introduced later ([c693280](https://github.com/serverless/console/commit/c69328043796780a62aaf4f724000a704df7e513))

## [0.8.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.7.0...@serverless/sdk-schema@0.8.0) (2022-09-20)

### ⚠ BREAKING CHANGES

- Types of some numeric tags were updated to more optimal ones

### Maintenance Improvements

- Improve types of numeric properties ([aa8dcc5](https://github.com/serverless/console/commit/aa8dcc52e309e7ec422af62570dd199c175a98bb))

## [0.7.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.6.0...@serverless/sdk-schema@0.7.0) (2022-09-16)

### ⚠ BREAKING CHANGES

- Remove `aws.sdk.account_id` tag
- Rename `aws.sdk.aws_service` to `aws.sdk.service`
- Remove `aws.sdk.dynamodb.table_names` in favor of singular `aws.sdk.dynamodb.table_name`
- Rename `aws.sdk.dynamodb.filter_expression` to `aws.sdk.dynamodb.filter` (to match convention)
- `aws.sdk.region` and `aws.sdk.request_id` are made optional
- `express.method` and `express.path` are made optional

### Features

- Remove `aws.sdk.account_id` as it's not directly accessible ([87af073](https://github.com/serverless/console/commit/87af073b9e87a2915c5cadf779355135c05282d6))
- Make `aws.sdk.region` and `aws.sdk.request_id` optional ([f6af48d](https://github.com/serverless/console/commit/f6af48d31474f2797a1b2f7a4494fbb7c40459b6))
- Remove obsolete `aws_` prefix ([1acc6cf](https://github.com/serverless/console/commit/1acc6cf3108cd506f7a05a26f8d5d0d9f666ce30))
- Rename `aws.sdk.dynamodb.filter_expression` to `aws.sdk.dynamodb.filter` (to match convention) ([1cd3f32](https://github.com/serverless/console/commit/1cd3f322f1977a74deda158265b529808323e76b))
- Configure `aws.sdk.dynamodb.key_condition` to store KeyConditionExpression ([11a98c9](https://github.com/serverless/console/commit/11a98c9eb84c57b55a6a861b8cab690918560d58))
- Update to singular `aws.sdk.dynamodb.table_name` field ([b87db6e](https://github.com/serverless/console/commit/b87db6e958b43371da335a02d807c437cca2a85d))
- Make all `express` tags optional ([96eae9f](https://github.com/serverless/console/commit/96eae9f108f1db621ea051a1f8567b6c712c167c))

## [0.6.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.5.0...@serverless/sdk-schema@0.6.0) (2022-09-14)

### ⚠ BREAKING CHANGES

- AWS SDK base tags are moved from service specific (`aws.sdk.<service>`) context to generic (`aws.sdk`)
- Remove`operation` tags from `aws.sdk.<service>` context in favor of existing `aws.sdk.operation` tag
- Number ids of tag properties in AWS SDK context are changed

### Features

- Move base AWS SDK tags to `aws.sdk` namespace ([4027b75](https://github.com/serverless/console/commit/4027b75db7b0ce0f99ea06097758e04dab805544))
- Remove duplicate `operation` tags ([47fe2c6](https://github.com/serverless/console/commit/47fe2c6deb9762fa138d0f7fd3f75c01dd97aa22))
- Add `aws.sdk.dynamodb.filter_expression` tag ([6bb5d3d](https://github.com/serverless/console/commit/6bb5d3df2b5f85b0aab4d2e5c6c456738e9bcb50))
- Cleanup numbering of tag properties ([8b8b582](https://github.com/serverless/console/commit/8b8b582bd84283f785bb6e1c1843aefb6604de08))

## [0.5.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.4.0...@serverless/sdk-schema@0.5.0) (2022-09-08)

### ⚠ BREAKING CHANGES

- Remove url related `aws.lambda.api_gateway.request` tags. Instead `aws.lambda.http` tags should be filled only
- Reordered tags in context `HttpTags` and added required `host` tag
- `ExpressTags.status_code` is converted to be optional
- `HttpTags.status_code` is converted to be optional

### Features

- Add RequestResponse Schema ([#177](https://github.com/serverless/console/issues/177)) ([9152c8a](https://github.com/serverless/console/commit/9152c8abece69d865e30f8bc70ecc4ec77ba83b0))
- Improve HTTP request tags ([855070d](https://github.com/serverless/console/commit/855070db2b9e856d6aad2b912cf534671ae5894b))
- Make `status_code` optional in express tracking ([e46b8d8](https://github.com/serverless/console/commit/e46b8d81deb384f5bf2cb6323475b233d168cfa0))
- Make `status_code` optional in HTTP tracking ([f862891](https://github.com/serverless/console/commit/f86289111b76a913253bb84d5f38eab99bc82848))
- Remove url related `aws.lambda.api_gateway.request` tags ([0861571](https://github.com/serverless/console/commit/0861571555a3939d6d8eeaa97f816a90a7410e37))

## [0.4.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.3.0...@serverless/sdk-schema@0.4.0) (2022-09-06)

### ⚠ BREAKING CHANGES

- `aws.lambda.sqs.operation` and `aws.lambda.sns.operation`are removed from schema (been added by mistake as they apply only to AWS SDK spans)

### Bug Fixes

- Remove tags which do not apply to `aws.lambda` span ([705087b](https://github.com/serverless/console/commit/705087b91d655df050849b9cfda326f85a447db8))

## [0.3.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.2.0...@serverless/sdk-schema@0.3.0) (2022-08-31)

### ⚠ BREAKING CHANGES

- `AwsApiGatewayRequestTags.string_parameters` is renamed to `AwsApiGatewayRequestTags.query_string_parameters`

#### Bug Fixes

- Fix schema property name ([6100b51](https://github.com/serverless/console/commit/6100b51d2a75ab21fa5442eef373875aa8020a5f))

## [0.2.0](https://github.com/serverless/console/compare/@serverless/sdk-schema@0.1.0...@serverless/sdk-schema@0.2.0) (2022-08-29)

### ⚠ BREAKING CHANGES

- Top level tags are no longer expected to have underscores replaced with ".", and they were reorganized into nested structure- Some properties out of `SlsTags` and `AwsLambdaTags` where changed to be optional

### Features

- Mark as optional properties not provided by the extension ([8ca71a6](https://github.com/serverless/console/commit/8ca71a65d77f7e9b4ae7323df1853a97fb32f05c))
- Unify tags definiton rules ([a55d091](https://github.com/serverless/console/commit/a55d09124fd35088f25dc3444faea46c98d2e922))

### 0.1.0 (2022-08-22)

- Initial Release of Schema ([bfb26db](https://github.com/serverless/console/commit/bfb26dbf146755553bcf1a73dbb39a02ad05da49))
