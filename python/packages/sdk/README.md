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
from sls_sdk import serverlessSdk
print(serverlessSdk.name)
print(serverlessSdk.version)

serverlessSdk.capture_error(Exception("Unexpected"))
```

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. Initialize and setup SDK specific to your enviroment

See [Environment extensions](#environment-extensions)

##### 2.1 Configuration options

_Common options supported by all environments:_

###### `SLS_ORG_ID` (or `org_id`)

Required setting. Id of your organization in Serverless Console.

##### `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` (or `disable_request_response_monitoring`)

(Dev mode only) Disable monitoring requests and reponses (function, AWS SDK requests and HTTP(S) requests)

##### `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` (or `disable_captured_events_stdout`)

Disable writing captured events registered via `.capture_error` and `.capture_warning` to stdout

### Instrumentation

This package comes with instrumentation for following areas.

_Note: instrumentation is enabled via environment specific SDK instance, relying just on `serverless-sdk` doesn't enable any instrumentation)_

- [Python logging module](docs/instrumentation/python-logging.md)

### API

- [serverlessSdk](docs/sdk.md)
