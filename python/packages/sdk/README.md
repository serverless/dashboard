# serverless-sdk

## [Serverless Console](https://www.serverless.com/console) SDK for Python

### Use case

Environment agnostic [Serverless Console](https://www.serverless.com/console) instrumentation functions for Python applications.

This library is safe to use without side-effects in any Python application. It becomes effective once (one of the listed below) environment specific SDK is loaded on top.

#### Environment extensions

- **AWS Lambda** - [serverless-aws-lambda-sdk](https://github.com/serverless/console/tree/main/python/packages/aws-lambda-sdk#readme)

### Installation

```shell
pip install serverless-sdk
```

### Usage

```python
from serverless_sdk import serverlessSdk
print(serverlessSdk.name)
print(serverlessSdk.version)
```

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. Initialize and setup SDK specific to your enviroment

See [Environment extensions](#environment-extensions)

##### 2.1 Configuration options

_Common options supported by all environments:_

###### `SLS_ORG_ID` (or `options.orgId`)

Required setting. Id of your organization in Serverless Console.

### Instrumentation

This package comes with instrumentation for following areas.

_Note: instrumentation is enabled via environment specific SDK instance, relying just on `serverless-sdk` doesn't enable any instrumentation)_

- N/A

### API

- [serverlessSdk](docs/sdk.md)
