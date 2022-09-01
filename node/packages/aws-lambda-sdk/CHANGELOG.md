# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
