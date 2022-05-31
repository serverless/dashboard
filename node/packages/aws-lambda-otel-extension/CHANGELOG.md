# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.2](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.3.1...@serverless/aws-lambda-otel-extension@0.3.2) (2022-05-31)

### Features

- Filter out Serverless Dashboard data logs ([b35c41c](https://github.com/serverless/runtime/commit/b35c41c61dd162606722944bce46f7a71d3475ce))

### [0.3.1](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.3.0...@serverless/aws-lambda-otel-extension@0.3.1) (2022-05-26)

### Bug Fixes

- Fix dependencies configuration ([9b41fa6](https://github.com/serverless/runtime/commit/9b41fa6198738669a5aebd58b7477f724888793d))

### Maintenance Improvements

- Bundle internal and external extensions into a single file ([9195c1e](https://github.com/serverless/runtime/commit/9195c1e8f760e27323ea65155fc3cef5e55d9ffb))
- Distinguish JSON from request data ([aa0141b](https://github.com/serverless/runtime/commit/aa0141be19c7b18cbb0f3abcab027d958f2ab052))
- Improve debug log for ingestion server requests ([d2b5233](https://github.com/serverless/runtime/commit/d2b5233020357c2384c894df5ef87e4ad2d03a0e))
- Improve debug log for telemetry payload ([b133ea6](https://github.com/serverless/runtime/commit/b133ea665b2d0308cbd41f7605e5dec15d3acba5))
- Log extension overhead processing durations ([7ddb265](https://github.com/serverless/runtime/commit/7ddb26576148f6c5466db00370fc5de770a6507a))
- Remove obsolete debug log ([59ae9a8](https://github.com/serverless/runtime/commit/59ae9a8b1b48356c5974f1dd758ceb404c098bd5))
- Rename `logMessage` to `debugLog` ([b7c2edc](https://github.com/serverless/runtime/commit/b7c2edcd3332d9383369e5ab1d8a68262b3be928))
- Simplify protobuf processing ([e339066](https://github.com/serverless/runtime/commit/e339066d4b1f7046e06fdbd911b7f838b8945596))

## [0.3.0](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.21...@serverless/aws-lambda-otel-extension@0.3.0) (2022-05-23)

### ⚠ BREAKING CHANGES

- Path to exec wrapper has changed from `/opt/otel-extension/internal/exec-wrapper.sh` to `/opt/otel-extension-internal-node/exec-wrapper.sh`. Change should be reflected when configuring `AWS_LAMBDA_EXEC_WRAPPER` environment variable for lambda

### Features

- Build script for runtime agnostic version of external extension ([e9fb48c](https://github.com/serverless/runtime/commit/e9fb48c0a75a058f6edac85033f8a8406fb1054a))
- Split internal and external extension into independent extensions ([13a7a72](https://github.com/serverless/runtime/commit/13a7a72a01c43d79176ef0f34b54fca64aba9651))

### Bug Fixes

- Fix handling of JSON type payloads ([5ba0175](https://github.com/serverless/runtime/commit/5ba0175b04a01311e9283c8d0b5a470a5b0d6347))

### Maintenance Improvements

- Rewrite external extension ([73cfc5c](https://github.com/serverless/runtime/commit/73cfc5c9c979f2d7b089f5fb3deca39ab1f52086))
- Drop `node-fetch` dependency in external extension ([cca15ed](https://github.com/serverless/runtime/commit/cca15ed850123ee2d7130bb7eb03d0de97ce8a52))
- Provide separate `userSettings` source for both extensions ([5a6909d](https://github.com/serverless/runtime/commit/5a6909dceabb7f73f15fb5055476e5b9d6f141dd))
- Remove `lodash.isobject` dependency ([4773a7c](https://github.com/serverless/runtime/commit/4773a7cf52b0684fc8db100b0b1321444539c612))
- Remove `OTEL_SERVER_PORT` definition from common scope ([fe443a7](https://github.com/serverless/runtime/commit/fe443a7fd5060b6182de5797aece98ba4d45aaac))
- Remove common `logMessage` ([a620a06](https://github.com/serverless/runtime/commit/a620a065e2c20d7a996ce0c64093686fea4c8c05))

### [0.2.21](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.20...@serverless/aws-lambda-otel-extension@0.2.21) (2022-04-29)

### Features

- Avoid sending binary response data ([dbb3711](https://github.com/serverless/runtime/commit/dbb3711b696a77290f93a36f1f2f2e190067c36a))

### [0.2.20](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.19...@serverless/aws-lambda-otel-extension@0.2.20) (2022-04-26)

### Bug Fixes

- Updated timeout error message ([2f49bcd](https://github.com/serverless/runtime/commit/2f49bcd291d4574384515a028060897fa36043c0))

### [0.2.19](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.18...@serverless/aws-lambda-otel-extension@0.2.19) (2022-04-21)

### Features

- Suport `userSettings.disableLogsMonitoring` ([54d1fa9](https://github.com/serverless/runtime/commit/54d1fa996e82566fd505d9e1975d9c641651d147))
- Support `userSettings.disableRequestResponseMonitoring` ([b7998b4](https://github.com/serverless/runtime/commit/b7998b42843e02e1fb76faf60a73e127c86bdb7d))

### Maintenance Improvements

- Centralize log listener server handling ([39fb512](https://github.com/serverless/runtime/commit/39fb51297105f8c3c491b41f151e592169601fb1))
- Centralize log listener server host and port configuration ([1c38e2d](https://github.com/serverless/runtime/commit/1c38e2d6a1a8b5dd3bc5ddef1f5bc24f8cc0e230))
- Centralize subscription configuration ([c6ffbc8](https://github.com/serverless/runtime/commit/c6ffbc8f61b2ebebceb35f4a576900ee27b3274a))
- Improve handling of dead paths ([9336587](https://github.com/serverless/runtime/commit/933658710e2dc814f0b2f2c1221c8044e924b132))
- Remove obsolete error handling ([7310032](https://github.com/serverless/runtime/commit/7310032176d1e9ddd17bde9378ea260844f6b044))
- Remove obsolete handling from telemetry server ([247dec6](https://github.com/serverless/runtime/commit/247dec6665597b7f6d56fa8454c18a32352d5458))
- Reorder initial setup ([7f9e364](https://github.com/serverless/runtime/commit/7f9e364d23ab7cf0341aa2e9e7e255f398cb2fa7))

### [0.2.18](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.12...@serverless/aws-lambda-otel-extension@0.2.18) (2022-04-13)

### Bug Fixes

- Adjusted code for integration tests ([5709511](https://github.com/serverless/runtime/commit/5709511ed5afd4b06c541383d39e0880feacd2fa))
- fixed integration test ([81aa93f](https://github.com/serverless/runtime/commit/81aa93fb295b980cad87b43e9b166005f138a020))
- Fixed waitFor bug ([8cf697a](https://github.com/serverless/runtime/commit/8cf697ad29d75ed04b8a3272c5e4c409c5fe37e4))

### [0.2.17](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.12...@serverless/aws-lambda-otel-extension@0.2.17) (2022-04-13)

### Bug Fixes

- fixed integration test ([81aa93f](https://github.com/serverless/runtime/commit/81aa93fb295b980cad87b43e9b166005f138a020))
- Fixed waitFor bug ([8cf697a](https://github.com/serverless/runtime/commit/8cf697ad29d75ed04b8a3272c5e4c409c5fe37e4))

### [0.2.13](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.12...@serverless/aws-lambda-otel-extension@0.2.13) (2022-04-13)

### Bug Fixes

- Fixed waitFor bug ([aa0658c](https://github.com/serverless/runtime/commit/aa0658cc8c3ab87708ec33c00f21dc93c1dc76e7))

### [0.2.12](https://github.com/serverless/runtime/compare/@serverless/aws-lambda-otel-extension@0.2.10...@serverless/aws-lambda-otel-extension@0.2.12) (2022-04-13)

### Bug Fixes

- Include spanId in req/res data ([1801503](https://github.com/serverless/runtime/commit/1801503557b09d97edbda16f94f990b6914c5bad))

### Maintenance Improvements

- Automate extension version resolution ([d1d8c12](https://github.com/serverless/runtime/commit/d1d8c124563b0481383c21b69e7f13576dafbab9))
- Improve `faas.collector_version` format ([9ccbfa1](https://github.com/serverless/runtime/commit/9ccbfa10c301d1234d595ae5b242bd43a42b1ade))
- Optimize instrumentations setup ([99b47fd](https://github.com/serverless/runtime/commit/99b47fd339f1a64312ef7c37baca54f6e9967ac1))
- Prevent misleading "No modules.." warning ([85fbc39](https://github.com/serverless/runtime/commit/85fbc399ad61914104d7f86e60699042d7fe6f79))
- Remove obsolete config configuration ([5b448ba](https://github.com/serverless/runtime/commit/5b448ba4c0bac1d9f6653151cad9d075916def3f))
- Remove obsolete instrumentation registration ([014b6b3](https://github.com/serverless/runtime/commit/014b6b39647df54643aa18086183479810aaf79a))
- Remove obsolete payload compression ([f5ceb3d](https://github.com/serverless/runtime/commit/f5ceb3d9151ad2183d3ebe5e1b079f4a7e788fea))
