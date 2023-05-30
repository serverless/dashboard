# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.15.4](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.15.3...@serverless/aws-lambda-sdk@0.15.4) (2023-05-30)

### Bug Fixes

- Fix handling of case where runtime waits for an empty event loop ([947a769](https://github.com/serverless/console/commit/947a7690ee548a6ec62576333d38359815368c04))

### [0.15.3](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.15.2...@serverless/aws-lambda-sdk@0.15.3) (2023-05-25)

### Bug Fixes

- Fix handling of not responding handlers ([7d06d67](https://github.com/serverless/console/commit/7d06d673a1162e0cb8e4967e6845bda858684c7a))

### Maintenance Improvements

- Access sub spans collection directly ([251fce4](https://github.com/serverless/console/commit/251fce463b3322e62b297cee5425fb3aa2aca0d1))

### [0.15.2](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.15.1...@serverless/aws-lambda-sdk@0.15.2) (2023-05-18)

### Bug Fixes

- Placeholder stream values when reporting request/response body ([03b3161](https://github.com/serverless/console/commit/03b3161eae56b67bb37705c52c987571719f8b61))

### Maintenance Improvements

- Improve organization of replacer logic ([92bb89e](https://github.com/serverless/console/commit/92bb89ea1eea27103de139660dcfda9a88888038))

### [0.15.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.15.0...@serverless/aws-lambda-sdk@0.15.1) (2023-05-17)

### Features

- Support response streaming ([2e7f8d0](https://github.com/serverless/console/commit/2e7f8d05d073325eb28c1e865a9b968f12b1724e))
- Do not write dev mode specific events in trace payload ([a324263](https://github.com/serverless/console/commit/a324263e46ccc56e3c468a947f716742b57ca1a1))

### Maintenance Improvements

- Improve filter logic organization ([50166a0](https://github.com/serverless/console/commit/50166a0d821e4fc3b33ba6fa10c8391168ac76c1))

## [0.15.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.23...@serverless/aws-lambda-sdk@0.15.0) (2023-05-11)

### ⚠ BREAKING CHANGES

- Telemetry payloads prefixed with `SERVERLESS_TELEMETRY.T.` are replaced with gzipped payloads written with `SERVERLESS_TELEMETRY.TZ.` prefix

### Performance Improvements

- Improve size of written telemetry log by gzipping it ([#738](https://github.com/serverless/console/issues/738)) ([3d28670](https://github.com/serverless/console/commit/3d2867082863fee3d6b168dae3d9a7eaaf5dadd8))

### [0.14.23](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.22...@serverless/aws-lambda-sdk@0.14.23) (2023-05-10)

### Maintenance Improvements

- Black box AWS SDK spans via new dedicated method ([1266baa](https://github.com/serverless/console/commit/1266baa98aa9170b1d2c6e57136d75e00d089a7f))

### [0.14.22](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.21...@serverless/aws-lambda-sdk@0.14.22) (2023-05-04)

_Adapt updates from v0.5.16 of `@serverless/sdk`_

### [0.14.21](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.20...@serverless/aws-lambda-sdk@0.14.21) (2023-04-28)

_Adapt updates from v0.5.15 of `@serverless/sdk`_

### [0.14.20](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.19...@serverless/aws-lambda-sdk@0.14.20) (2023-04-27)

_Adapt updates from v0.5.14 of `@serverless/sdk`_

### [0.14.19](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.18...@serverless/aws-lambda-sdk@0.14.19) (2023-04-27)

### Features

- Improve sampling resolution ([beb7208](https://github.com/serverless/console/commit/beb7208133fc4f70d2d89b5f719ce032b6e273b9))

### Bug Fixes

- Ensure our `--require` option is first ([e7d8a3e](https://github.com/serverless/console/commit/e7d8a3eec7bba01d27ed92de142538b687f842f3))

### [0.14.18](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.17...@serverless/aws-lambda-sdk@0.14.18) (2023-04-26)

### Maintenance Improvements

_Adapt updates from v0.5.12 of `@serverless/sdk`_

### [0.14.17](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.16...@serverless/aws-lambda-sdk@0.14.17) (2023-04-21)

### Bug Fixes

- Ensure `sdk.runtime` tag on all payloads ([5f44099](https://github.com/serverless/console/commit/5f4409982b7f1939c772d2550c51d9de9404a33d))

### Maintenance Improvements

- Remove no longer supported option ([9ecade7](https://github.com/serverless/console/commit/9ecade774f727f8d7e8b56c8c5454cb02f57bc9f))

### [0.14.16](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.15...@serverless/aws-lambda-sdk@0.14.16) (2023-04-20)

### Maintenance Improvements

_Adapt bug fixes from `@serverless/sdk` to v0.5.10_

### [0.14.15](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.14...@serverless/aws-lambda-sdk@0.14.15) (2023-04-20)

### Maintenance Improvements

_Adapt bug fixes from `@serverless/sdk` to v0.5.9_

### [0.14.14](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.13...@serverless/aws-lambda-sdk@0.14.14) (2023-04-14)

### Bug Fixes

- Span not closed warnings are now user warnings ([#649](https://github.com/serverless/console/issues/649)) ([d2b958c](https://github.com/serverless/console/commit/d2b958c070ecc2af490f25f73e588f740b05ea76))

### [0.14.13](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.12...@serverless/aws-lambda-sdk@0.14.13) (2023-04-14)

### Features

- Add Structured Logging error capture ([#643](https://github.com/serverless/console/issues/643)) ([59db882](https://github.com/serverless/console/commit/59db8824530eede7b4657129aa20c882573b52e3))

### [0.14.12](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.11...@serverless/aws-lambda-sdk@0.14.12) (2023-04-12)

### Bug Fixes

- SDK will report warning for unclosed spans ([#635](https://github.com/serverless/console/issues/635)) ([77192f3](https://github.com/serverless/console/commit/77192f3266a1e46efbecb04f3c7f84b5d21c231f))

### [0.14.11](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.10...@serverless/aws-lambda-sdk@0.14.11) (2023-04-06)

### Features

- Improve sampling algorithm ([0428512](https://github.com/serverless/console/commit/0428512e1f01ec5d323fc488304839cc129b1b73))
- Recognize ALB events ([4ceaca3](https://github.com/serverless/console/commit/4ceaca3001f03cca9ba0afecc67bc8378c5a97bb))

### Bug Fixes

- Ensure to clear root span in case of internal error ([#611](https://github.com/serverless/console/issues/611)) ([7c7856e](https://github.com/serverless/console/commit/7c7856ed99b0fffee92a3bf5151148978cc6ec25))

### Maintenance Improvements

- Improve configurablity of sampling function ([e26be68](https://github.com/serverless/console/commit/e26be682a7defad5d203819006021d4259266eb2))
- Seclude `isApiEvent` util ([81d7e4a](https://github.com/serverless/console/commit/81d7e4ab1da508edf4a5bb9a580f967cecc47bd4))

### [0.14.10](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.9...@serverless/aws-lambda-sdk@0.14.10) (2023-04-03)

### Bug Fixes

- Ensure aws-lambda-sdk types match aws-sdk ([#597](https://github.com/serverless/console/issues/597)) ([1e1b739](https://github.com/serverless/console/commit/1e1b73915354876bbb4fb54f5881bbffc5cff269))

### [0.14.9](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.8...@serverless/aws-lambda-sdk@0.14.9) (2023-03-29)

### Features

- Write `sdk.runtime` tag ([065af50](https://github.com/serverless/console/commit/065af505536979ce1ac602c379a2009da4ca134a))

### [0.14.8](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.7...@serverless/aws-lambda-sdk@0.14.8) (2023-03-15)

### Features

- Enforce 20% sampling on successful invocations in prod environment ([80a02b4](https://github.com/serverless/console/commit/80a02b44eb8cc6c95d65b29976ca71b23f8d2537))

### [0.14.7](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.6...@serverless/aws-lambda-sdk@0.14.7) (2023-02-28)

### Bug Fixes

- Ensure to not capture logs issued by the AWS runtime ([2df64ee](https://github.com/serverless/console/commit/2df64eecf59679e8693107cd9e19f33bb752d6a8))

### [0.14.6](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.5...@serverless/aws-lambda-sdk@0.14.6) (2023-02-10)

### Features

- Strip binary lambda request ([2b85fe8](https://github.com/serverless/console/commit/2b85fe81ee9492442e28ed954eadf61c7adb12b5))
- Strip large lambda request and response bodies ([afd9ec9](https://github.com/serverless/console/commit/afd9ec98c39e57c99af2e4a9efaa290f15afeecc))
- Strip too large AWS SDK request bodies ([de064c1](https://github.com/serverless/console/commit/de064c1ac2babe94036dfc034992308ce7222ef7))

### Maintenance Improvements

- Do not strip non JSON bodies ([431b48e](https://github.com/serverless/console/commit/431b48e4918e978b7e947c7ca99d709d174c9267))
- Ensure to not proces request and response when not in dev mode ([9d016aa](https://github.com/serverless/console/commit/9d016aa4e1436ecb3b852c9102d2548d00d3f088))
- Exclude `runEsbuild` util ([7d985c4](https://github.com/serverless/console/commit/7d985c4fc436158cadb3bf671b5688a2b5f52105))
- Report binary response body removal with notice event ([52588a0](https://github.com/serverless/console/commit/52588a01245ad8aa88bb77bc74b7553c734bd701))

### [0.14.5](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.4...@serverless/aws-lambda-sdk@0.14.5) (2023-02-02)

### Maintenance Improvements

_Upgrade to `@serverless/sdk` to v0.5.0_

- Adapt to utility rename done on SDK side ([2f16112](https://github.com/serverless/console/commit/2f16112c9e3e1050d17188e307e0914997d766ed))
- Reconfigure warnings with `._reportWarning` ([22b8d4f](https://github.com/serverless/console/commit/22b8d4f2258b97500e8640bd99417d27ca8b4b10))

### [0.14.4](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.3...@serverless/aws-lambda-sdk@0.14.4) (2023-02-01)

_Upgrade to `@serverless/sdk` to v0.4.4_

### [0.14.3](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.2...@serverless/aws-lambda-sdk@0.14.3) (2023-01-30)

### Features

- Prevent lambda crashes on internal SDK errors ([6f350a9](https://github.com/serverless/console/commit/6f350a9ca6cbbf1d318507a34a27ad9d10ffc93a))

### Bug Fixes

- Do not send root span without required tag to dev mode ([44b0e4e](https://github.com/serverless/console/commit/44b0e4e92ab3f1c8704978e182ae69ae52e01874))
- Fix AWS SDK v3 request error reporting ([3dd663c](https://github.com/serverless/console/commit/3dd663c46151694c2a3e5ed4ed048465a9309d71))
- Fix handling of uncommon AWS SDK error report ([64afe99](https://github.com/serverless/console/commit/64afe993f0717ccfc752e5ee23fdea20463dbc1d))
- Fix invocation closure race condition ([13649b2](https://github.com/serverless/console/commit/13649b227e22ef600bf468215ca6d8fd59e77274))

### Maintenance Improvements

- Rely on newly introduced `reportSdkError` util ([e7d9cc0](https://github.com/serverless/console/commit/e7d9cc0529569a830ba72959e6f120fcb244b5f0))
- Clear dead referrences to `global.serverlessSdk` ([048e72e](https://github.com/serverless/console/commit/048e72e916d80fefa212b89e998678631f0fff87))
- Improve logic explanation ([96c39a6](https://github.com/serverless/console/commit/96c39a6c3d7b4b6bdf7c26fea338f17c962392fe))
- Improve readability of inline comment ([e6a40a2](https://github.com/serverless/console/commit/e6a40a24434f9dc0c4ebbe07d8587e225ff57139))

### [0.14.2](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.1...@serverless/aws-lambda-sdk@0.14.2) (2023-01-26)

### Maintenance Improvements

- Upgrade to SDK v0.4.1 ([efc2220](https://github.com/serverless/console/commit/efc2220edda74f7d9476688d06b1ad792d8eb1d2))

### [0.14.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.14.0...@serverless/aws-lambda-sdk@0.14.1) (2023-01-23)

### Bug Fixes

- Ensure to clear custom tags collection between invocations ([b8eadb6](https://github.com/serverless/console/commit/b8eadb68e453fd68dba86d5e9ba191b6c20154d6))

## [0.14.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.13.1...@serverless/aws-lambda-sdk@0.14.0) (2023-01-19)

### ⚠ BREAKING CHANGES

- Outcome error meta is no longer provided with outcome error tags on `aws.lambda` root span.
  Instead it's transported with captured event which shares same timestamp with `aws.lambda` root span end time
- Global custom tags are exposed on TracePayload instead of the root span

### Features

- Propagate all captured events to `dev mode` ([e19b41e](https://github.com/serverless/console/commit/e19b41e9f9152999cb99e00fbf325f405f6b60a7))

### Bug Fixes

- Ensure to not instrument requests signing ([ebf90ca](https://github.com/serverless/console/commit/ebf90cabc340b11068b8addeec94a16a5a9d04b1))
- Handle gently non JSON compliant AWS SDK input and output ([321a8f5](https://github.com/serverless/console/commit/321a8f569a2406ff83966bff3df987c3b6c35264))

### Maintenance Improvements

- Expose custom tags directly on trace instead of root span ([91786ae](https://github.com/serverless/console/commit/91786aee5b5891252788c318ad983efcf35e83ca))
- Remove `responseStartTime` in favor of `endTime` ([33618d6](https://github.com/serverless/console/commit/33618d68362a166307255326dcdba969b893dbf1))
- Report outcome error data with event instead of root span tags ([87766c9](https://github.com/serverless/console/commit/87766c9e66363ee9942c5398e52b0c754c7ba408))

### [0.13.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.13.0...@serverless/aws-lambda-sdk@0.13.1) (2023-01-13)

### Features

- Report traces at unhandled exceptions in invocation phase ([eadeaee](https://github.com/serverless/console/commit/eadeaeedb04390c101a7b2f0d9eae2acd317e0d1))
- Upgrade to `@serverless/sdk` v0.3.1 (Introduce `servelressSdk.setTag`) ([78c5532](https://github.com/serverless/console/commit/78c5532b13588f27d84b3a2acdfc9b0e1987fd4f))

### Maintenance Improvements

- Support trace closure at initialization phase ([48262d0](https://github.com/serverless/console/commit/48262d0962889fe9fb5eae75b8c329fb00551f5e))

## [0.13.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.12.0...@serverless/aws-lambda-sdk@0.13.0) (2023-01-12)

### ⚠ BREAKING CHANGES

- Upgrade to `@serverless/sdk` v0.3. `serverlessSdk.captureTraceSpan` is no longer available

### Features

- Upgrade to `@serverless/sdk` v0.3 ([e415fbc](https://github.com/serverless/console/commit/e415fbcdb8b80cd0c0fb6bffe754d4f654bf66ca))
- Report internal warnings with structured logs ([63d046a](https://github.com/serverless/console/commit/63d046a033565d1196d2d1ae89fbae81e938e226))
- Ensure DynamoDB tags on AWS SDK spans that cover DynamoDbDocument service ([#354](https://github.com/serverless/console/issues/354)) ([1b49f9e](https://github.com/serverless/console/commit/1b49f9e9affecfcf469dc469bb43470bdedcfc41))

## [0.12.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.6...@serverless/aws-lambda-sdk@0.12.0) (2023-01-05)

### ⚠ BREAKING CHANGES

- `global.serverlessSdk` was removed. `@serverless/aws-lambda-sdk` and `@serverless/sdk` are now exposed in node path and can be required or imported naturally

### Features

- Expose `@serverless/sdk` in path instead of realying on a global ([8f4ff07](https://github.com/serverless/console/commit/8f4ff0741df73c8e6d0b3afa3ec20e3d915fdb9b))
- Report captured events with a trace payload ([5437bd7](https://github.com/serverless/console/commit/5437bd72e7ee8c2df6618bb953e9f4bc79c1948e))
- Send captured events to dev mode ([dfb7991](https://github.com/serverless/console/commit/dfb799116cfef18e262840546bceec5cd7e2303b))

### Bug Fixes

- Ensure to reset root span also in case of errors ([1d8277c](https://github.com/serverless/console/commit/1d8277cfc87cccd90213e06e51eea0530edcb729))
- Initialize original handler at AWS intended processing point ([60db9bf](https://github.com/serverless/console/commit/60db9bfffee7358ee30009b4637d69c0aaa439e8))

### Maintenance Improvements

- Centralize SDK resolution ([2f8b39c](https://github.com/serverless/console/commit/2f8b39c5920736d7576c9162bb553f48798c74ba))
- Depend on `@serverless/sdk` ([57e3621](https://github.com/serverless/console/commit/57e3621ae68ff544d4b14610baeae04e87dac8dc))
- Do not send Node's console originated events to dev extension ([d3a2e41](https://github.com/serverless/console/commit/d3a2e411f1513cf0474546a53dc60b733307e7dd))

### [0.11.6](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.5...@serverless/aws-lambda-sdk@0.11.6) (2022-12-19)

### Bug Fixes

- Do not attempt to set AWS SDK request id when there's no request ([85f02ad](https://github.com/serverless/console/commit/85f02adb46f93325b6e01678fc4de05c5212d766))
- Do not crash in case of AWS SDK v2 double resolution setup ([95449b8](https://github.com/serverless/console/commit/95449b899de59600f13d62a9c446b3292d302ddd))

### [0.11.5](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.4...@serverless/aws-lambda-sdk@0.11.5) (2022-12-13)

### Bug Fixes

- Fix handling of deferred spans, started before handler invocation ([0970940](https://github.com/serverless/console/commit/0970940e88c06b0d937a4c55d237723550f6dd60))
- To respect open handles wait for response to end ([cc3a531](https://github.com/serverless/console/commit/cc3a531353bef5b6bce1d80911b10ff6544f50ea))
- Reduce number of concurrently open requests to avoid EMFILE ([55d314d](https://github.com/serverless/console/commit/55d314d85e186d21f7e9561a1c5b39929e784615))
- Clear `input` and `output` for trace payload reliably ([03140cb](https://github.com/serverless/console/commit/03140cbf7af52f88b8e91bc444b2cf8bfa3ef19a))

### Maintenance Improvements

- Upgrade `@serverless/sdk-schema` to v0.14 ([365ba4e](https://github.com/serverless/console/commit/365ba4e5258c1df65d945372904096afddf64f33))
- Limit maximum number of concurrent requests to avoid EMFILE ([d16b28c](https://github.com/serverless/console/commit/d16b28c258630808957488df3109fa9592878f01))
- Remove dead code ([73c9fa5](https://github.com/serverless/console/commit/73c9fa54c896a52567dedab0c34f087affd15a53))

### [0.11.4](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.3...@serverless/aws-lambda-sdk@0.11.4) (2022-11-24)

### Bug Fixes

- Ensure to not crash in main SDK processing points ([5499231](https://github.com/serverless/console/commit/54992319357db3d4d215ea0c86f233dbdd0654a9))

### [0.11.3](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.2...@serverless/aws-lambda-sdk@0.11.3) (2022-11-08)

### Maintenance Improvements

- Improve SDK error messaging ([f35ff84](https://github.com/serverless/console/commit/f35ff84bde2b6051303e2fe79fc77eab7613aaee))

### [0.11.2](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.1...@serverless/aws-lambda-sdk@0.11.2) (2022-11-03)

### Bug Fixes

- Ensure warning ends with new line ([18e902f](https://github.com/serverless/console/commit/18e902f65631c56f3a85ad92af3e578f49c3482d))

### Maintenance Improvements

- Improve build script error reporting ([c26c936](https://github.com/serverless/console/commit/c26c936a19f7c4dad85311e85266613d4ce8659c))
- Reshape HTTP request args handling ([13a3a53](https://github.com/serverless/console/commit/13a3a53116a259a2f8962e79cd24738e209ff71b))

### [0.11.1](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.11.0...@serverless/aws-lambda-sdk@0.11.1) (2022-10-31)

### Bug Fixes

- Fix handling of no response lambdas ([279c5c7](https://github.com/serverless/console/commit/279c5c7c5fabd1e93f0eb8ff207a601b2de02dda))

## [0.11.0](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.10.2...@serverless/aws-lambda-sdk@0.11.0) (2022-10-31)

### ⚠ BREAKING CHANGES

- Upgrade `@serverless/sdk-schema` from v0.12 to v0.13

### Features

- Report all kind of responses ([2731384](https://github.com/serverless/console/commit/2731384fe4a291def130877d73a8ca654f23e9fa))
- Support Node.js v12 ([5737b5c](https://github.com/serverless/console/commit/5737b5c222e76a02a47c4603deeecfd6927122fd))

### Bug Fixes

- Fix capture of HTTP response body when it's a string ([466fc22](https://github.com/serverless/console/commit/466fc22e8f22d6cbcc08beb503ed7c1733175020))

### Maintenance Improvements

- Cleanup support for `startTime` and `endTime` in response ([e5ef5e8](https://github.com/serverless/console/commit/e5ef5e8acef239265ec122c61d5d0ac7e3ef221b))
- Upgrade to `@serverless/sdk-schema` v0.13 ([6ad4b72](https://github.com/serverless/console/commit/6ad4b72ebc261807f918a4e3158bc08c5d87c884))

### [0.10.2](https://github.com/serverless/console/compare/@serverless/aws-lambda-sdk@0.10.1...@serverless/aws-lambda-sdk@0.10.2) (2022-10-24)

### Features

- Added timestamp to req/res payloads ([#280](https://github.com/serverless/console/issues/280)) ([ffc1dcd](https://github.com/serverless/console/commit/ffc1dcd423dee1bf9d6142df17a8d9b23a451049))

### Bug Fixes

- Matched invocation start/end time ([1080d28](https://github.com/serverless/console/commit/1080d286132430804f48bfe01ba7fab676135124))

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
