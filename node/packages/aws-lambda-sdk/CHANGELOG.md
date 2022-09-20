# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.5.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.4.0...@serverless/aws-lambda-sdk@0.5.0) (2022-09-20)

### ⚠ BREAKING CHANGES

- Upgrade `@serverless/sdk-schema` to v0.8

### Features

- Instrument express applications ([be10ac2](https://github.com/serverless/console/commit/be10ac2fb7b45b680a590c2aa1b5b4b48e9b03d9))
- Trace AWS SDK requests going to any services ([c6dbe17](https://github.com/serverless/console/commit/c6dbe17b9ba15f885b251b44fa50486e99e4c572))

### Maintenance Improvements

- Uprade `@serverless/sdk-schema` to v0.8 ([72bfa6d](https://github.com/serverless/console/commit/72bfa6d89b33906e2b9a247e8410ce057a50a3d4))

## [0.4.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.3.2...@serverless/aws-lambda-sdk@0.4.0) (2022-09-16)

### ⚠ BREAKING CHANGES

- Upgrade `@serverless/sdk-schema` to v0.7

### Features

- Instrument AWS SDK requests ([8fe8676](https://github.com/serverless/console/commit/8fe867621b6d0421c5fe4bf951353b01eaa1af22))
- Support ignoring specified HTTP requests from tracing ([63a0450](https://github.com/serverless/console/commit/63a0450f525c2a7e726ad1006968a5bbb744e663))

### Bug Fixes

- Ensure safe requires order ([f853179](https://github.com/serverless/console/commit/f853179d34f73e6233bc49b293d7eddc91d76229))

### Maintenance Improvements

- Do not crash if tag is re-set with same value ([d9c5647](https://github.com/serverless/console/commit/d9c56475fc53f294962dd4ae3b6df5567f253046))
- Make `serverlessSdk._initialize` private ([887bbc4](https://github.com/serverless/console/commit/887bbc4af82662d37f7fea8c8303f773f5a52506))
- Upgrade `@serverless/sdk-schema` to v0.7 ([2f481f8](https://github.com/serverless/console/commit/2f481f8b22d7902336460f17a67b01df53e9a1d3))

### [0.3.2](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.3.1...@serverless/aws-lambda-sdk@0.3.2) (2022-09-14)

### Features

- Write request and response payloads ([b04f030](https://github.com/serverless/console/commit/b04f0303444ffd44a3930cc4a098562641a56ff9))
- An option to disable HTTP instrumentation ([c5da3fd](https://github.com/serverless/console/commit/c5da3fdf2b75862c46da9d56045099d064c25da4))

### Maintenance Improvements

- Cleanup logic ([06869fc](https://github.com/serverless/console/commit/06869fc44cd3b9a06c2527a92942fc70b17352f7))
- Do not write debug JSON payload ([f94c874](https://github.com/serverless/console/commit/f94c87482ec7729c0ef6d079aa60de100c705cfe))
- Generalize handling of instrumentation configuration ([84887b3](https://github.com/serverless/console/commit/84887b3e3f2947804a59fd489545ee6353239c94))

### [0.3.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.3.0...@serverless/aws-lambda-sdk@0.3.1) (2022-09-12)

### Features

- Auto tracing of internal HTTP and HTTPS requests ([ab8a428](https://github.com/serverless/console/commit/ab8a428300fecca298fbb966f563da1edf997563))
- `TraceSpan` option `onCloseByParent` ([f34b5d8](https://github.com/serverless/console/commit/f34b5d802f4f7ce6f391a89b87dedab5ea2d7409))

### Bug Fixes

- Fix wrapping of nested ESM handlers ([03e7c18](https://github.com/serverless/console/commit/03e7c18405af2cc59f30342387961ac0de8a56dc))

### Maintenance Improvements

- Rely on `tags.setMany` to set initial tags set ([dd8522a](https://github.com/serverless/console/commit/dd8522a6b71a12ec7f80009e377dd5d5414fa3fe))

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
