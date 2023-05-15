# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.4.8 (2023-05-15)

### Bug Fixes

- Handle binary HTTP request/response body gracefully, when instrumenting http calls

### Maintenance Improvements

- Improve linter config to have stricter checks

## 0.4.7 (2023-05-09)

### Performance Improvements

- Remove dependency on wrapt to reduce package size and latency

## 0.4.6 (2023-05-05)

### Performance Improvements

- Use version file to remove importlib-metadata import
- Use custom pub/sub implementation instead of blinker

### Maintenance Improvements

- Specify python classifiers for pypi
- Fix static type checking issues

## 0.4.5 (2023-04-26)

### Bug Fixes

- Fix request response decoding
- Fix span hierarchy in multithreaded usage

## 0.4.4 (2023-04-20)

### Maintenance Improvements

- Support Python v3.10

## 0.4.3 (2023-04-20)

### Bug Fixes

- Fix duration resolution in HTTP instrumentation

### Performance Improvements

- Fix initialization performance regression

## 0.4.2 (2023-04-18)

### Features

- Override `aws.lambda.http_router.path` tag with Flask route

## 0.4.1 (2023-04-17)

### Bug Fixes

- Fix race condition in HTTP trace spans
- Fix setting of duplicate tags with same value

### Maintenance Improvements

- Improve internal configurability of HTTP instrumentation
- Use context variables to selectively ignore instrumentation of HTTP requests

## 0.4.0 (2023-04-13)

### Features

- Instrument http requests
- Instrument flask

### ⚠ BREAKING CHANGES

- `_sls_ignore` is required to be set for dev-mode telemetry requests

## 0.3.11 (2023-04-06)

### Bug Fixes

- Ensure thread-safety of public attributes/methods
- Do not include `custom_tags` field when there are no custom tags set
- Write structured logs as json serialized string

## 0.3.10 (2023-04-04)

### Maintenance Improvements

- Rename module as `sls_sdk` and alias public api as `serverless_sdk`

## 0.3.9 (2023-04-04)

- Revert breaking rename of package module from `serverless_sdk` to `sls_sdk`

## 0.3.8 (2023-03-30)

- Change name of package module from `serverless_sdk` to `sls_sdk`

## 0.3.7 (2023-03-27)

### Maintenance Improvements

- Remove unused dependencies

## 0.3.6 (2023-03-23)

### Features

- Add `_report_notice` method
- Emit `trace-span-close` event when a span is closed

## 0.3.5 (2023-03-22)

### Features

- Allow to set options via arguments in addition to env variables.

## 0.3.4 (2023-03-20)

### Bug Fixes

- Fix behind the scenes logging

## 0.3.3 (2023-03-20)

### Features

- Instrument `.error` & `.warning` methods of Python's native `Logger` class.

## 0.3.2 (2023-03-17)

### Bug Fixes

- Fix custom tags serialization

## 0.3.1 (2023-03-16)

### Features

- Add `serverlessSdk.capture_warning` method, providing a way to report warnings.
- Add `origin` & `fingerprint` parameters to `serverlessSdk.capture_error`

## 0.3.0 (2023-03-15)

### Features

- Add `serverlessSdk.set_tag` method, providing a way to set custom tags on the trace.

### ⚠ BREAKING CHANGES

- List of captured events are removed

## 0.2.1 (2023-03-14)

### Features

- Add `serverlessSdk.capture_events` method, providing a way to report error events
- Support update of `tags` with a prefix

### Maintenance Improvements

- Event emitter implementation

## 0.2.0 (2023-03-09)

### ⚠ BREAKING CHANGES

- Submodules from `serverless_sdk.span` are moved to `serverless_sdk.lib`
- Base module logic is moved into `serverless_sdk`

### Maintenance Improvements

- Refactor internal modules to follow similar folder structure to NodeJS SDK.
- Move tests out of the package code

## 0.1.4 (2023-03-08)

### Bug Fixes

- Fix timestamps in trace spans.

## 0.1.3 (2023-03-07)

### Bug Fixes

- Fix root trace span handling
- Maintain deterministic ordering of trace spans

## 0.1.2 (2023-03-03)

### Bug Fixes

- Fix protobuf serialization
- Fix trace span and timing

### 0.1.1 (2023-02-22)

### Maintenance Improvements

- Fix PyPI release

### 0.1.0 (2023-02-22)

### Features

- Initial version ([3687baa](https://github.com/serverless/console/commit/3687baac1f5c2f48518eebb0a400801d8f4ec54a))
- Invalid PyPI release
