# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
