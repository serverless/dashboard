# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.3.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.2.1...@serverless/aws-lambda-sdk@0.3.0) (2022-09-08)

### ⚠ BREAKING CHANGES

- `@serverless/sdk-schema` was upgraded to v0.5.0, which changed structure of API Gateway event related tags

### Features

- Setup`aws.lambda.event_type` and `aws.lambda.event_source` tags ([c21622d](https://github.com/serverless/console/commit/c21622d8c143159346e6fb68cdb176c0f83475c4))
- Setup `aws.lambda.http.status_code` tag ([f60ec61](https://github.com/serverless/console/commit/f60ec6162f06d57eda8de64c1c8f1b7b0a4c571d))
- Write generic `aws.lambda.http` tags in case of API Gateway events ([3231a6c](https://github.com/serverless/console/commit/3231a6c48c370862db73b203ee70e3f541ebc101))

### [0.2.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.2.0...@serverless/aws-lambda-sdk@0.2.1) (2022-09-06)

### Features

- Instrument API Gateway v2 HTTP API (v1 payload) events ([82fefe2](https://github.com/serverless/console/commit/82fefe27f430e103fdd06019c3289727bb9622f6))
- Instrument API Gateway v2 HTTP API (v2 payload) events ([f09907e](https://github.com/serverless/console/commit/f09907e4d76c3c78f1fb8d598e4a998f875d86e8))
- Instrument SNS events ([a228bb7](https://github.com/serverless/console/commit/a228bb719b105b355967ee5295897958b97af89d))
- Instrument SQS events ([cea70d6](https://github.com/serverless/console/commit/cea70d629184a0b5400648d6134368e092db8ce3))
- Support arrays as tag values ([def9dfc](https://github.com/serverless/console/commit/def9dfc59bb13435afa9860c73269826aa6cadd7))

## [0.2.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.1.0...@serverless/aws-lambda-sdk@0.2.0) (2022-09-01)

### ⚠ BREAKING CHANGES

- Telemetry payload prefix is changed from `⚡` to `SERVERLESS_TELEMETRY`

### Features

- Instrument API Gateway REST API events ([233880f](https://github.com/serverless/console/commit/233880fd633bc1d2b5d6cf6b04d12b666585d682))
- Introduce `traceSpan.tags.setMany` method ([ab730db](https://github.com/serverless/console/commit/ab730db5b9dc8980a44d60a70bdd55c556c7b86a))

### Maintenance Improvements

- Change telemetry log prefix to `SERVERLESS_TELEMETRY` ([52fd7df](https://github.com/serverless/console/commit/52fd7df2c73d992044e9b3c26e34a5c62811a068))
- Improve tags reset handling ([6bda7f9](https://github.com/serverless/console/commit/6bda7f96402265f191a825b74cac49cb1f318c02))
- Remove ineffective code ([87307e8](https://github.com/serverless/console/commit/87307e8cb8c12e2c10617eb8ce4b7fb3334911d9))

### 0.1.0 (2022-08-29)

### Features

Initial implementation
