# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
