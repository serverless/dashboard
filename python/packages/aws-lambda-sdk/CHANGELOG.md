# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.1.12 (2023-04-05)

### Bug Fixes

- Fix customer module initialization

### Maintenance Improvements

- Use internal module name when importing base SDK to prevent name collision

## 0.1.11 (2023-03-30)

- Change name of package module from `sls_sdk.` to `sls_sdk`

## 0.1.10 (2023-03-29)

### Features

- Dev mode
- Performance improvements

### Bug Fixes

- Fix SDK crash handling

## 0.1.9 (2023-03-20)

### Features

- Enforce 20% sampling on successful invocations in prod environment

### Bug Fixes

- Fix wrapper logging and error reporting

### Maintenance Improvements

- Improve wrapper script to use the current process and not spawn a new process
- Reduce lambda layer size by upgrading to `serverless-sdk-schema v0.1.1`

## 0.1.8 (2023-03-16)

### Features

- Include custom tags in trace

### Maintenance Improvements

- Use event emitter for listening on captured errors
- Improve lambda layer build script

## 0.1.7 (2023-03-14)

### Features

- Include captured error events in trace

### Bug Fixes

- Catch all customer handler errors, including unhandled errors

## 0.1.6 (2023-03-09)

### Bug Fixes

- Ensure support for Python v3.8+
- Fix log messages appearing twice
- Ensure debug message is prefixed with "⚡ SDK: "

## 0.1.5 (2023-03-07)

_Re-release due to broken publication process_

## 0.1.4 (2023-03-07)

_Re-release due to broken publication process_

## 0.1.3 (2023-03-07)

_Re-release due to broken publication process_

## 0.1.2 (2023-03-07)

_Re-release due to broken publication process_

## 0.1.1 (2023-03-07)

_Re-release due to broken publication process_

## 0.1.0 (2023-03-07)

### Features

- Initial version
