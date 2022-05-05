# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
