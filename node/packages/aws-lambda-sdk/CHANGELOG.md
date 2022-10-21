# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.10.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.10.0...@serverless/aws-lambda-sdk@0.10.1) (2022-10-21)

## [0.10.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.9.1...@serverless/aws-lambda-sdk@0.10.0) (2022-10-20)

### ⚠ BREAKING CHANGES

- SDK Schema is upgraded to v0.11 - `http.request_body`, `http.response_body`, `aws.sdk.request_body` and `aws.sdk.response_body` tags are removed in favor of top level `input` and `output` properties.

### Features

- Adapt `span.input` and `span.output` ([bb5e222](https://github.com/serverless/console/commit/bb5e222f2f1efd5392ffb5cc6cb259d388238673))

### [0.9.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.9.0...@serverless/aws-lambda-sdk@0.9.1) (2022-10-17)

### Features

- Do not trace DynamoDb request `expressionValues` ([bbc118d](https://github.com/serverless/console/commit/bbc118dd3cd8d92178b198439e96be040629c72f))

## [0.9.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.8.1...@serverless/aws-lambda-sdk@0.9.0) (2022-10-11)

### ⚠ BREAKING CHANGES

- Dev mode communication port was changed from 2772 to 2773. For compatibiility upgrade to v0.3+ version of the dev-mode layer

### Maintenance Improvements

- Switch dev mode communication port ([6df2fc9](https://github.com/serverless/console/commit/6df2fc9659eb7210768b135206b0a9d70e5957b5))

### [0.8.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.8.0...@serverless/aws-lambda-sdk@0.8.1) (2022-10-10)

### Bug Fixes

- Ensure opt-out for request and response monitoring ([0555565](https://github.com/serverless/console/commit/0555565c25c9cc7490a90ef8c06651be1c6f15f8))

## [0.8.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.7.0...@serverless/aws-lambda-sdk@0.8.0) (2022-10-07)

### ⚠ BREAKING CHANGES

- Request and response bodies are not longer reported in CloudWatch logs

### Features

- Support "dev" mode ([8e74674](https://github.com/serverless/console/commit/8e74674335bcfeed76e3ad891dfb685c15299228))
- Report AWS SDK request and response body in dev mode ([8e87989](https://github.com/serverless/console/commit/8e87989e805b08fa007efb7eeb70e7d9c7d2d296))
- Expose HTTP request and response bodies in tags in dev mode ([eefcb33](https://github.com/serverless/console/commit/eefcb3329946dd5c94e6e8b50898f112e8b9fe62))
- In dev mode send spans as they are closed to external extension ([72b59b8](https://github.com/serverless/console/commit/72b59b8aa9ab09705a9a9110bc7b5e836e405236))
- Do not write request and response payloads ([6d604c9](https://github.com/serverless/console/commit/6d604c9516e3664442435e26abfa4b807c87c289))

### Maintenance Improvements

- Improve variables naming ([99973ff](https://github.com/serverless/console/commit/99973ff4676b73abbd616156359c768a63333aef))
- Support internal `_slsIngore` option to ignore HTTP requests ([85cb986](https://github.com/serverless/console/commit/85cb9861e799ecfd8fc756031f800382dea9ac95))

## [0.7.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.6.0...@serverless/aws-lambda-sdk@0.7.0) (2022-09-30)

### ⚠ BREAKING CHANGES

- Upgrade `@serverless/sdk-schema` to v0.10 (Switch from `express` tags to `aws.lambda.http_router`)
- Rename `instrument/*`utilities into `instrumenation/*`
- Rename `serveressSdk.instrument` into `serverlessSdk.instrumentation`

### Features

- Support for Function URL events ([d9f619c](https://github.com/serverless/console/commit/d9f619c507035378b9b4200d660ad8d578615334))
- Switch from `express` tags to `aws.lambda.http_router` ([64f7543](https://github.com/serverless/console/commit/64f7543ad971acb6c3d8b85bc832cda1a2975b22))

### Bug Fixes

- Fix span connections for consequently initialized async operations ([cd2798e](https://github.com/serverless/console/commit/cd2798e8f9d1b2978406a2d52ff830b53f34ebdf))
- Fix open parent span resolution ([84f63e9](https://github.com/serverless/console/commit/84f63e9e99ab03b7c45046e503efc03aa5767c4d))

### Maintenance Improvements

- Add temporary debug logs ([8588da0](https://github.com/serverless/console/commit/8588da0b01b298f26229b70bbebd5a3bacce1267))
- Expose `debugLog` util on `serverlessSdk` ([bb25145](https://github.com/serverless/console/commit/bb2514564af8cb0011cb4f8a430c4685166c3148))
- Improve middleware span resolution ([641a690](https://github.com/serverless/console/commit/641a690e3f8b672fdc46e3dc511f90dc2f8335ab))
- Rename `instrument` namespace into `instrumentation` ([88054dc](https://github.com/serverless/console/commit/88054dc789a1d151d61ade5ab909bd612d8ceab3))
- Separate `instrument` utility context ([e159740](https://github.com/serverless/console/commit/e159740e4d9aeee7b574d4d6e99a8e24ce52bd5f))

## [0.6.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.5.0...@serverless/aws-lambda-sdk@0.6.0) (2022-09-26)

### ⚠ BREAKING CHANGES

- Upgrade `@serverless/sdk-schema` to v0.9.0
- HTTP related have changed according to changes brought with new version of `@serverless/sdk-schema`
- Sub spans must be closed manually (they're no longer auto closed with closure of a parent)
- All opened spans are auto closed with a warning on root span closure (when trace is wrapped up)
- `onCloseByParent` option is replaced by `onCloseByRoot`, as it's only root that may auto close sub spans now
- `traceSpan.createSubSpan` method was removed in favor of `serverlessSdk.createTraceSpan`. Since now relations between spans are resolved automaticaly internally (no need to manually decide which span is parent span)

### Features

- Allow opened children in closed spans ([d2f87d7](https://github.com/serverless/console/commit/d2f87d796f99ee35f38769a26fe8e0f5d19dc456))
- Resolve relation between spans automatically ([a7e2b5e](https://github.com/serverless/console/commit/a7e2b5e9e9cb88137d45159cfec31516c33dbb27))
- Store `http.request_header_names` tag ([223371c](https://github.com/serverless/console/commit/223371ca3a52cd17af3e8397bcf84fd37702621d))
- Support new AWS SDK DynamoDB tags ([1963d4b](https://github.com/serverless/console/commit/1963d4b31184412987c3baab3c6da8867c287b1a))
- Upgrade HTTP related tags to contain only param names information ([0fed793](https://github.com/serverless/console/commit/0fed793f9dbec40bd4b6598fe77db071a5d6a8c4))

### Bug Fixes

- Fix propagation of response data ([135c524](https://github.com/serverless/console/commit/135c524005143315caa65a9662b78b4a22b57acf))

### Performance Improvements

- Ensure to not add unused dependencies to build ([ce2f6e4](https://github.com/serverless/console/commit/ce2f6e4132f082e967771e33d7decd743079ce94))

### Maintenance Improvements

- Improve test error code ([a396de3](https://github.com/serverless/console/commit/a396de38b7501ace2065626318f0284d3afbce0a))

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
