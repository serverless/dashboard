# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.1](https://github.com/serverless/console/compare/@serverless/sdk@0.2.0...@serverless/sdk@0.2.1) (2023-01-05)

### Features

- `serverless.captureWarning` utility ([f559a2e](https://github.com/serverless/console/commit/f559a2ed11301cdb6b7f9a9577ff22f804eac881))
- Instrument `console.error` ([0647848](https://github.com/serverless/console/commit/0647848572a0c5a8405fe29c289487bda2d476d5))
- Instrument `console.warn` ([9088bbe](https://github.com/serverless/console/commit/9088bbe1ba8e18649d0d5cce9867090275ef7a3f))

### Maintenance Improvements

- Differentiate events sourced from `console.*` calls ([bea40aa](https://github.com/serverless/console/commit/bea40aa8f7fd234c70f0b9e7e59c1c9b8304190a))
- Fix location of `createErrorCapturedEvent` module ([07210b1](https://github.com/serverless/console/commit/07210b121957658b6f854a82dd6a652e1401bcb3))
- Simplify `console.error` args handling ([8d3d254](https://github.com/serverless/console/commit/8d3d254a046b8ed65251526b11a994393c871257))

## [0.2.0](https://github.com/serverless/console/compare/@serverless/sdk@0.1.0...@serverless/sdk@0.2.0) (2022-12-22)

### ⚠ BREAKING CHANGES

- Remove resolution of `aws.lambda.outcome` tag enum. This needs to be done in the context of `aws-lambda-sdk`
- Trace span event emitter is generalized (to be not only Trace span specific) and relocated, it is accessible now at `_eventsEmitter` instead of `_traceSpanEmitter` property on SDK
- Trace span events are renamed from `open` to `trace-span-open` and `close` to `trace-span-close`

### Features

- `serverless.captureError` with internal `CapturedEvent` interface ([b808b8a](https://github.com/serverless/console/commit/b808b8aecb29e862a5b13365b2a6160f169a6cdd))
- Remove AWS specific logic ([2ab35d0](https://github.com/serverless/console/commit/2ab35d0961b59191acbc090df21c4c0ada736c04))

### Maintenance Improvements

- Exclude `resolveEpochTimestampString` ([284908c](https://github.com/serverless/console/commit/284908ced51271bafd81f23777dcf03e609330a8))
- Exclude `Tags` interface from `TraceSpan` context ([1cafe8b](https://github.com/serverless/console/commit/1cafe8b976fd67394cb25ea1f1e3ad6038586c1c))
- Exclude `toLong` utility ([8571198](https://github.com/serverless/console/commit/8571198206d8bb8a9523ef5b103b7353c815c78c))
- Fix typo in internal function name ([a1bd97c](https://github.com/serverless/console/commit/a1bd97c06d52f0faba99f93e81552fa5ca6f18c4))
- Generalize `ensureXName` logic ([e93607b](https://github.com/serverless/console/commit/e93607b91452fc5f4ad8f068c79755a2c90fe3dd))
- Generalize internal event emitter ([80c5961](https://github.com/serverless/console/commit/80c5961a981959f5fce060a9e882fd6c952b8ddf))
- Implement `tags.toJSON()` ([7d9fc1f](https://github.com/serverless/console/commit/7d9fc1f619c005a9e99628fa310a7d38a8af2d5c))
- Remove dead code ([14f3613](https://github.com/serverless/console/commit/14f3613c73788885f627f36be483b2ec574bd486))
- Seclude `generateId` utility ([e8842c7](https://github.com/serverless/console/commit/e8842c734714cb6c21b598b6d4f088f4769d5f5a))
- Seclude `toProtobufEpochTimestamp` ([e886a5e](https://github.com/serverless/console/commit/e886a5e88e2c6e2f8496d48df1d433cb4018b66b))
- Seclude `toProtobuTags` utility ([47f2598](https://github.com/serverless/console/commit/47f2598a8dd15a05cd8f3dc69964536c02f531a4))
- Simplify `traceSpan.startTime` validation ([60d62f6](https://github.com/serverless/console/commit/60d62f66daa5914066722686215ad09d40427af4))

### 0.1.0 (2022-12-15)

### Features

- Initial version (taken out from `@serverless/aws-lambda-sdk`) ([4a41a0a](https://github.com/serverless/console/commit/4a41a0af11996c8c8fb83ebdbe3d96fb243998c9))
