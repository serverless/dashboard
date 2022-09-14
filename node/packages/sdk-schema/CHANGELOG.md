# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
