# @serverless/aws-lambda-sdk

## AWS Lambda dedicated tracing utility

Instruments AWS Lambda functions and propagates traces to the [Serverless Console](https://www.serverless.com/console/docs)

### Setup

#### 1. Register with [Serverless Console](https://console.serverless.com/)

#### 2. Instrument functions with the SDK in one of the following ways:

##### (A) Attach internal extension layer

Resolve Layer ARN with following steps

- Search for latest release of `@serverless/aws-lambda-sdk` at https://github.com/serverless/console/releases
- In attached `sls-sdk-node.json` asset, find ARN of a layer in a region in which function is deployed

1. Attach layer to the function
2. Configure following environment variables for the function environment:
   - `SLS_ORG_ID`: _(id of your organization in Serverless Console)_
   - `AWS_LAMBDA_EXEC_WRAPPER`: `/opt/sls-sdk-node/exec-wrapper.sh`

##### (B) Instrument function manually

1. Ensure `@serverless/aws-lambda-sdk` dependency installed for the function

2. Decorate function handler:

_CJS:_

```javascript
const instrument = require('@serverless/aws-lambda-sdk/instrument');

module.exports.handler = instrument(
  (event, context, callback) => {
    /* Original handler logic */
  },
  options // Optional, see documentation below
);
```

_ESM:_

```javascript
import instrument from '@serverless/aws-lambda-sdk/instrument';

export const handler = instrument(
  (event, context, callback) => {
    /* Original handler logic  */
  },
  options // Optional, see documentation below
);
```

#### Configuration options.

Extension can be configured either via environment variables, or in case of manual instrumentation by passing the options object to `instrument` function;

If given setting is set via both environment variable and property in options object, the environment variable takes precedence.

##### `SLS_ORG_ID` (or `options.orgId`)

Required setting. Id of your organization in Serverless Console.

##### `SLS_DISABLE_HTTP_MONITORING` (or `options.disableHttpMonitoring`)

Disable tracing of HTTP and HTTPS requests

##### `SLS_DISABLE_REQUEST_MONITORING` (or `options.disableRequestMonitoring`)

Disable lambda requests (events) monitoring

##### `SLS_DISABLE_RESPONSE_MONITORING` (or `options.disableResponseMonitoring`)

Disable lambda responses monitoring

### Outcome

SDK automatically creates the trace that covers internal process of function invocation and initialization. For all the details check [docs/sdk-trace.md](docs/sdk-trace.md)

If not disabled request and response payloads are written to logs encoded with protobuf format
