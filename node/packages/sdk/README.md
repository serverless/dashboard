# @serverless/sdk

## [Serverless Console](https://www.serverless.com/console) SDK

### Use case

Environment agnostic [Serverless Console](https://www.serverless.com/console) instrumentation functions for Node.js applications.

This library is safe to use without side-effects in any Node.js applications. It becomes effective once (one of the listed below) environment specific SDK is loaded on top.

#### Environment extensions

- **AWS Lambda** - [@serverless/aws-lambda-sdk](https://github.com/serverless/console/tree/main/node/packages/aws-lambda-sdk#readme)

### Installation

```shell
npm install @serverless/sdk
```

### Usage

_CJS:_

```javascript
const serverlessSdk = require('@serverless/sdk');

// ...
serverlessSdk.captureError(new Error('Unexpected'));
```

_ESM:_

```javascript
import serverlessSdk from '@serverless/sdk';

// ...
serverlessSdk.captureError(new Error('Unexpected'));
```

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. Initialize and setup SDK specific to your enviroment

See [Environment extensions](#environment-extensions)

##### 2.1 Configuration options

_Common options supported by all environments:_

###### `SLS_ORG_ID` (or `options.orgId`)

Required setting. Id of your organization in Serverless Console.

##### `SLS_DISABLE_HTTP_MONITORING` (or `options.disableHttpMonitoring`)

Disable tracing of HTTP and HTTPS requests. See [HTTP instrumentation](docs/instrumentation/http.md)

##### `SLS_DISABLE_REQUEST_RESPONSE_MONITORING` (or `options.disableRequestResponseMonitoring`)

(Dev mode only) Disable monitoring requests and reponses (function, AWS SDK requests and HTTP(S) requests)

##### `SLS_DISABLE_EXPRESS_MONITORING` (or `options.disableExpressMonitoring`)

Disable automated express monitoring. See [express app instrumentation](docs/instrumentation/express-app.md)

##### `SLS_DISABLE_CAPTURED_EVENTS_STDOUT` (or `options.disableCapturedEventsStdout`)

Disable writing captured events registered via `.captureError` and `.captureWarning` to stdout

### Instrumentation

This package comes with instrumentation for following areas.

_Note: instrumentation is enabled via environment specific SDK instance, relying just on `@serverless/sdk` doesn't enable any instrumentation)_

- [HTTP(s) requests](docs/instrumentation/http.md)
- [express app](docs/instrumentation/express-app.md)
- [Node.js console](docs/instrumentation/node-console.md)

### API

- [serverlessSdk](docs/sdk.md)
