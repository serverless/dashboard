# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.5.19](https://github.com/serverless/console/compare/@serverless/sdk@0.5.18...@serverless/sdk@0.5.19) (2023-05-18)

### Bug Fixes

- Fix error data resolution from AWS Powertools error log ([fcb6fe7](https://github.com/serverless/console/commit/fcb6fe7fc25a708ada0758874b1ef342211bf2c9))
- Ensure to expose our crashes that `console` will swallow ([81f680e](https://github.com/serverless/console/commit/81f680ea1873f854b7a3fdded5cd9e243c24deb6))

### [0.5.18](https://github.com/serverless/console/compare/@serverless/sdk@0.5.17...@serverless/sdk@0.5.18) (2023-05-17)

### Features

- Enable filters configuration for HTTP requests ([554e358](https://github.com/serverless/console/commit/554e358e62848ddde08d8e88ddfdc68b00749a4e))

### [0.5.17](https://github.com/serverless/console/compare/@serverless/sdk@0.5.16...@serverless/sdk@0.5.17) (2023-05-10)

### Bug Fixes

- Fix detection of not observed response body ([f7eb441](https://github.com/serverless/console/commit/f7eb4419869bff2f0fa4b69d94cd175919813f1a))

### Maintenance Improvements

- Support black boxing internal spans ([4ae3a31](https://github.com/serverless/console/commit/4ae3a31333e1e599e1a5e91ab8d3cc8a6e5fe068))
- Do not create HTTP trace spans in black box context ([12ef23b](https://github.com/serverless/console/commit/12ef23b87ed6aa34785e1d942b3177240f72f794))
- Remove no longer needed debug logs ([978deb8](https://github.com/serverless/console/commit/978deb849f915a2e27a08411b38d9b17b51163c8))

### [0.5.16](https://github.com/serverless/console/compare/@serverless/sdk@0.5.15...@serverless/sdk@0.5.16) (2023-05-04)

### Bug Fixes

- Ensure to resolve stack trace only for exposed logs ([c71982e](https://github.com/serverless/console/commit/c71982e50e133824d8dea272d79f659cdf9cb3ee))

### [0.5.15](https://github.com/serverless/console/compare/@serverless/sdk@0.5.14...@serverless/sdk@0.5.15) (2023-04-28)

### Bug Fixes

- Resolve parametrized paths with nested routers ([1f30b8e](https://github.com/serverless/console/commit/1f30b8e30bd4852b4ed1480f92a4a2ab4934e88b))

### [0.5.14](https://github.com/serverless/console/compare/@serverless/sdk@0.5.13...@serverless/sdk@0.5.14) (2023-04-27)

### Bug Fixes

- Fix resolution of parametrized route paths ([7bdc66f](https://github.com/serverless/console/commit/7bdc66f23c14b4786316b1c0425b0a7ac5d1368e))

### [0.5.13](https://github.com/serverless/console/compare/@serverless/sdk@0.5.12...@serverless/sdk@0.5.13) (2023-04-27)

### Bug Fixes

- Fix log levels parsing in structured logs instrumentation ([#694](https://github.com/serverless/console/issues/694)) ([21f0929](https://github.com/serverless/console/commit/21f09295e4fa2cdcfdce605d8be19291806c00cf))

### [0.5.12](https://github.com/serverless/console/compare/@serverless/sdk@0.5.11...@serverless/sdk@0.5.12) (2023-04-26)

### Features

- Full resolution of paths that involve nested express routers ([e3641aa](https://github.com/serverless/console/commit/e3641aa245c2471bf1a4eae895af13674bf5d222))

### [0.5.11](https://github.com/serverless/console/compare/@serverless/sdk@0.5.10...@serverless/sdk@0.5.11) (2023-04-21)

### Bug Fixes

- Ensure to report unexpected parsing issues ([0864381](https://github.com/serverless/console/commit/0864381355f42e1acb52247c97dd3054a9deba98))

### Maintenance Improvements

- Optimise JSON string detection ([f38b906](https://github.com/serverless/console/commit/f38b90631f2c15c1e230ede7b049fed76dfd2b67))
- Optimize error data detection ([45c4a65](https://github.com/serverless/console/commit/45c4a6593e445aa6cd370fe2741f63f7f2c8ed7d))
- Remove obsolete debug log ([3034aa7](https://github.com/serverless/console/commit/3034aa7c5750c80a881f159bdcba8294a2f3a846))

### [0.5.10](https://github.com/serverless/console/compare/@serverless/sdk@0.5.9...@serverless/sdk@0.5.10) (2023-04-20)

### Bug Fixes

- Do not fail on missing `layer.method` ([21aabd9](https://github.com/serverless/console/commit/21aabd98a7c22223814962132608acaa16907f74))

### Maintenance Improvements

- Improve `sdk._reportWarning` resolution ([65ad54b](https://github.com/serverless/console/commit/65ad54b5485f5c1bda324b468f826437b44eb437))

### [0.5.9](https://github.com/serverless/console/compare/@serverless/sdk@0.5.8...@serverless/sdk@0.5.9) (2023-04-20)

### Bug Fixes

- Fix router middleware detection in Express instrumentation ([f89cc69](https://github.com/serverless/console/commit/f89cc69638e7bbe9820e355528ab0e138bae4a0a))

### Maintenance Improvements

- Fix information in inline comment ([a7ea178](https://github.com/serverless/console/commit/a7ea178bbb1711ddb2b0afa7dee306c5037b60a7))

### [0.5.8](https://github.com/serverless/console/compare/@serverless/sdk@0.5.7...@serverless/sdk@0.5.8) (2023-04-14)

### Bug Fixes

- Updated warning type to user ([#648](https://github.com/serverless/console/issues/648)) ([6a2e446](https://github.com/serverless/console/commit/6a2e446125fe39921fdcd02a9c83987bf50568e4))

### [0.5.7](https://github.com/serverless/console/compare/@serverless/sdk@0.5.6...@serverless/sdk@0.5.7) (2023-04-13)

### Features

- Capture Structured Logs as Errors & Warnings ([#638](https://github.com/serverless/console/issues/638)) ([4311ac1](https://github.com/serverless/console/commit/4311ac19edb00198189fe40f8a159453d699cc30))

### [0.5.6](https://github.com/serverless/console/compare/@serverless/sdk@0.5.5...@serverless/sdk@0.5.6) (2023-04-12)

### Bug Fixes

- SC-799 Added capture warning when spans are not closed ([#631](https://github.com/serverless/console/issues/631)) ([16f9a8b](https://github.com/serverless/console/commit/16f9a8b9ced92a39c4fcff9af50e50ee7315aa1c))

### [0.5.5](https://github.com/serverless/console/compare/@serverless/sdk@0.5.4...@serverless/sdk@0.5.5) (2023-04-06)

### Maintenance Improvements

- Write JSON strings as structured logs ([e5f5162](https://github.com/serverless/console/commit/e5f51629ea079308559c343937f27280949ec9ab))

### [0.5.4](https://github.com/serverless/console/compare/@serverless/sdk@0.5.3...@serverless/sdk@0.5.4) (2023-03-29)

### Bug Fixes

- Fix resolution of url data from `options.path` in HTTP instrumentation ([e5a4ccd](https://github.com/serverless/console/commit/e5a4ccda713f02de771bdc381bb72e5ee39c374a))

### [0.5.3](https://github.com/serverless/console/compare/@serverless/sdk@0.5.2...@serverless/sdk@0.5.3) (2023-03-01)

### Maintenance Improvements

- Ensure full stack traces in debug mode ([cd87544](https://github.com/serverless/console/commit/cd87544c1ca822244ac5f5735469e78ccaf63664))
- Minimize needed debug logs verbosity ([2171f39](https://github.com/serverless/console/commit/2171f39638a095eb616d141f5e241fdaaff853a5))

### [0.5.2](https://github.com/serverless/console/compare/@serverless/sdk@0.5.1...@serverless/sdk@0.5.2) (2023-02-24)

### Bug Fixes

- Respect native HTTP request error handling ([bc1f263](https://github.com/serverless/console/commit/bc1f263f22004614676133adcd00919d72d9b4b9))

### [0.5.1](https://github.com/serverless/console/compare/@serverless/sdk@0.5.0...@serverless/sdk@0.5.1) (2023-02-10)

### Bug Fixes

- Remove support for `traceCaptureBodySizeKb` setting (relying on it may introduce bugs) ([8d5d410](https://github.com/serverless/console/commit/8d5d4105f820f97b2168284d57b327bdb4285b9a))

### Maintenance Improvements

- Internal `_reportNotice` interface ([8aac3f2](https://github.com/serverless/console/commit/8aac3f2aa205b286d1d463d77f5272500dc94f84))
- Report with notice large HTTP bodies ([e9b59ca](https://github.com/serverless/console/commit/e9b59ca537d55e851caae2ece3cb6b34865c0318))

## [0.5.0](https://github.com/serverless/console/compare/@serverless/sdk@0.4.4...@serverless/sdk@0.5.0) (2023-02-02)

### ⚠ BREAKING CHANGES

- All internal warnings need to be configured via `serverlessSdk._reportWarning` to be reflected as captured events
- `serverless._reportSdkError` is renamed to `serverless._reportError`

### Features

- Dedicated internal endpoint for reporting warnings ([685cb2a](https://github.com/serverless/console/commit/685cb2a7a24313c01d961fa6d26d7547b6b1c93d))
- Support different SDK error types and reflect the type in structured log ([d45cbfa](https://github.com/serverless/console/commit/d45cbfaa7950927aa920992ab8444d3d666553b5))
- Write captured events reported with `.capture*` methods to stdout ([4f940eb](https://github.com/serverless/console/commit/4f940ebacab518e71fa60eafd17d511144a7f353))

### Bug Fixes

- Ensure to always generate captured events for internal errors ([dc1e70f](https://github.com/serverless/console/commit/dc1e70f9ff21c6ca30492869294c219e2faa01ac))
- Ensure to always generate captured events for internal warnings ([eef80e0](https://github.com/serverless/console/commit/eef80e06a086dc3c1af20b75803abcc8b9a94666))

### Maintenance Improvements

- Reflect internal error types in structured log ([0f7f554](https://github.com/serverless/console/commit/0f7f554a069ba7660d80acada2309246b59a2438))
- Rename `._reportSdkError` to `._reportError` ([33327cb](https://github.com/serverless/console/commit/33327cbe0ddcf5daf60c7217f35f2f3f41a34c62))

### [0.4.4](https://github.com/serverless/console/compare/@serverless/sdk@0.4.3...@serverless/sdk@0.4.4) (2023-02-01)

### Bug Fixes

- Do not define `undefined` properties in structured error ([37e2491](https://github.com/serverless/console/commit/37e2491b9c0baa8ea606db1d1e595bccbb9e6d8a))
- Ensure to unpack structured SDK errors for captured events ([b0ecd2b](https://github.com/serverless/console/commit/b0ecd2ba17eb6cb4b238b6518f7c1f0c882b2be1))

### Maintenance Improvements

- Improve stack trace presentation in SDK error ([40c3930](https://github.com/serverless/console/commit/40c3930796b8783bfbc565df9182d7f2c977138a))
- Report stack trace with simpler `stack` property ([a6f4604](https://github.com/serverless/console/commit/a6f46040e987524616f79088f90107df274224e5))

### [0.4.3](https://github.com/serverless/console/compare/@serverless/sdk@0.4.2...@serverless/sdk@0.4.3) (2023-01-30)

### Features

- Log instead of throw on invalid internal tag settings ([8b4c595](https://github.com/serverless/console/commit/8b4c595564cf082661bb9cfc7ff6e9e2c32df2ab))
- Prevent lambda crashes on internal SDK errors ([015c598](https://github.com/serverless/console/commit/015c598d6f9e76235bf25186108074c5ab0d7edc))

### Maintenance Improvements

- Introduce `._reportSdkError` for silent error reporting ([f2a5c5d](https://github.com/serverless/console/commit/f2a5c5db366283c55cfe8a1fbc0fadc5a1344b3d))
- Prevent HTTP releated debug log when instrumentation is off ([1c6f201](https://github.com/serverless/console/commit/1c6f201889d3d1e6d2d3939763b2d8740e7faa34))
- Seclude `resolveNonErrorName` util ([57e28f5](https://github.com/serverless/console/commit/57e28f53896ba816a96744633f73126f7fb5e75d))

### [0.4.2](https://github.com/serverless/console/compare/@serverless/sdk@0.4.1...@serverless/sdk@0.4.2) (2023-01-27)

### Bug Fixes

- Fix manual `express` instrumentation ([0fefb5a](https://github.com/serverless/console/commit/0fefb5a202321369599db4cb0687e12f1e122c46))

### [0.4.1](https://github.com/serverless/console/compare/@serverless/sdk@0.4.0...@serverless/sdk@0.4.1) (2023-01-26)

### Features

- Cover each `console.error` invocation with captured event ([c37ef74](https://github.com/serverless/console/commit/c37ef74094d8012570364572be69eaf633b44227))
- Store stack trace with each captured error and warning ([eadaafa](https://github.com/serverless/console/commit/eadaafa7f8b3258996e5a16d826bada94fa7f85c))

## [0.4.0](https://github.com/serverless/console/compare/@serverless/sdk@0.3.1...@serverless/sdk@0.4.0) (2023-01-19)

### ⚠ BREAKING CHANGES

- Root (global) tags are no longer stored on the root span. Instead they're stored on SDK directly and are expected to be considered as trace-wide tags

### Bug Fixes

- Ensure not to crash on invalid `serverless.setTag` input ([c5f28ff](https://github.com/serverless/console/commit/c5f28ff552fc023c24819e24ec90a88ff00d4d73))
- Fix `expressApp` instrumentation endpoint ([11314b4](https://github.com/serverless/console/commit/11314b434b4d62f6e7dde25a9ca8a09e6f584fde))
- Warn instead of throw when SDK is used without initialization ([fe64a4f](https://github.com/serverless/console/commit/fe64a4f53529285e89a64f7d50ec9528a3c4ce57))

### Maintenance Improvements

- Enable customization of event data via private options ([a5e8f36](https://github.com/serverless/console/commit/a5e8f365ad8e4e700ffb31e47a1f9bd7bba2af2c))
- Store global tags on SDK directly (not on root span) ([9a72787](https://github.com/serverless/console/commit/9a727875ac4f694552d987a346473a09191104ce))

### [0.3.1](https://github.com/serverless/console/compare/@serverless/sdk@0.3.0...@serverless/sdk@0.3.1) (2023-01-13)

### Features

- `serverlessSdk.setTag` ([c546bcd](https://github.com/serverless/console/commit/c546bcd85bc8ee6d77926ad655c2696eea270ef1))
- Automatically resolve `.traceSpans.root` ([99eb5e2](https://github.com/serverless/console/commit/99eb5e2f20cd60c3e99c75d7e33e70845ef7f9b2))

## [0.3.0](https://github.com/serverless/console/compare/@serverless/sdk@0.2.4...@serverless/sdk@0.3.0) (2023-01-12)

### ⚠ BREAKING CHANGES

- `sdk.createTraceSpan` is removed. The functionality of creating custom spans is not considered part of public API at the time being (a new method for that will be introduced in one of the following releases)

### Features

- Make `createTraceSpan` private ([017ef10](https://github.com/serverless/console/commit/017ef109c1f6ad23adb6b020121b41a4ca539d35))
- Dedicated handling for structured warnings issued by the SDK ([1d38f5f](https://github.com/serverless/console/commit/1d38f5f59e435139ad7fac3c27f30e861cc3fdf2))
- Relax tag name format restriction ([414108f](https://github.com/serverless/console/commit/414108f57dbeb7189c000fb20bc0ac177e85bbfb))
- Log error instead of throwing on invalid capturedEvent user input ([b958948](https://github.com/serverless/console/commit/b958948fa7396a3e26a16606b2bcd98c652bb4fa))

### Maintenance Improvements

- Fixed typings file ([#369](https://github.com/serverless/console/issues/369)) ([2deeb4b](https://github.com/serverless/console/commit/2deeb4b49b196eadde6ca85fc87f7fb9c00f453c))
- Revert problematic TS addition ([ad88aab](https://github.com/serverless/console/commit/ad88aab5c2ff39429ddbe56804c34192e1b3b4d0))

### [0.2.4](https://github.com/serverless/console/compare/@serverless/sdk@0.2.3...@serverless/sdk@0.2.4) (2023-01-11)

### Features

- Support custom fingerprints ([b29b1e5](https://github.com/serverless/console/commit/b29b1e5bb430a8909dc77d536602b8986c904d3b))

### [0.2.3](https://github.com/serverless/console/compare/@serverless/sdk@0.2.2...@serverless/sdk@0.2.3) (2023-01-09)

### Bug Fixes

- Adjusted typescript implementation for sdk ([#360](https://github.com/serverless/console/issues/360)) ([e8a7066](https://github.com/serverless/console/commit/e8a7066b7c02833a00d38aa8b8456d0e26b417a9))

### [0.2.2](https://github.com/serverless/console/compare/@serverless/sdk@0.2.1...@serverless/sdk@0.2.2) (2023-01-09)

### Bug Fixes

- Ensure `_origin` on created events before they're emited ([#353](https://github.com/serverless/console/issues/353)) ([9c6bef2](https://github.com/serverless/console/commit/9c6bef28c57c41cb838ee0c95733809882f7150d))

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
