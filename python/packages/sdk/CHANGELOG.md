# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
