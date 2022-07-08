# @serverless/aws-lambda-otel-extension

## AWS Lambda extension that gathers [OpenTelemetry](https://opentelemetry.io/) data and sends it to the designated destination

_Package is still in an experimental stage and subject to major changes._

_At this point, only Node.js runtime is supported, but this support will be extended in the near future_

### How does it work?

The extension is a lambda layer with a source maintained in [opt](opt) folder. There are two extensions configured within a layer:

1. External, placed in [opt/otel-extension/external](opt/otel-extension/external) folder, which gathers information (from (1) execution environment (2) AWS Lambdas APIs (3) Data provided via internal extension) and sends the compliant [OpenTelemetry](https://opentelemetry.io/) payload to designated destination (see [Configure destination endpoints of telemetry payloads](#configure-destination-endpoints-of-telemetry-payloads))
2. Internal, placed in [opt/otel-extension/internal](opt/otel-extension/internal) folder, which is pre-run in the same process as Node.js Lambda handler, and through pre-setup instrumentation gathers additional data about invocations, which is sent to external extension

### What telemetry payload does it generate?

_TODO: This section will be completed in the near future_

### How to configure AWS Lambda to use it?

#### 1. Build layer artifact

##### 1.2 Node.js runtime version (external + internal extension)

_Note: pre-build layer artifacts are published with `@serverless/aws-lambda-otel-extension-dist` package, and instead of building it manually (as documented below) it is advised to rely on them instead._

```sh
# Ensure layer dependencies are installed
cd external/otel-extension-external
npm install
cd ../../internal/otel-extension-internal-node
npm install

# Build artifact
cd ../../
npm run build
```

Artifact is generated into `dist/extension.zip` file

##### 1.3 Runtime agnostic version (just external extension)

Runtime agnostic version (of just external layer) can be built as following

```sh
# Ensure layer dependencies are installed
cd external/otel-extension-external
npm install

# Build artifact
cd ../../
npm run build:external
```

Artifact is generated into `dist/extension-external.zip` file

##### 1.4 Custom settings

Monitoring settings (as documented below) can also be bundled into generated layers, for that pass path to settings file with `--settings-filename` param. File is expected to be a valid Node.js CJS module, It can be plain JSON, or JS, which can be helpful in case of dynamically resolved settings

```sh
npm run build -- --settings-filename <path>
```

#### 2. Publish layer

Publish layer artifact to your AWS account

#### 3. Attach layer to target Lambda and configure necessary environment variables

Ensure that layer version ARN is listed in Lambda layers.

Ensure that internal extension of a layer is pre-loaded by configuring `AWS_LAMBDA_EXEC_WRAPPER` environment variable with `/opt/otel-extension-internal-node/exec-wrapper.sh`

##### 4. Configure monitoring settings

Monitoring settings are expected to be provided in JSON format at `SLS_OTEL_USER_SETTINGS` environment variable.

All settings are optional, still if no settings are provided, the generated telemetry reports will be just logged into process output.

Supported settings:

```yaml
common:
  # Settings common to all reports
  destination:
    # Request headers for server (url) destinations
    requestHeaders: param1=value&param2=value # search params string of headers to be added to each request
logs:
  # Log report settings
  disabled: true # Disable logs monitoring
  # Destination can be HTTP/HTTPS url, or S3 bucket. If not provided reports are written to the console
  destination: https://some-url/ | s3://bucketname[/rootkey]
metrics:
  outputType: protobuf | json # Output type (defaults to protobuf)
  # Destination can be HTTP/HTTPS url, or S3 bucket. If not provided reports are written to the console
  destination: https://some-url/ | s3://bucketname[/rootkey]
request:
  # Request report settings
  disabled: true # Disable request reporting
  # Destination can be HTTP/HTTPS url, or S3 bucket. If not provided reports are written to the console
  destination: https://some-url/ | s3://bucketname[/rootkey]
response:
  # Response report settings
  disabled: true # Disable response reporting
  # Destination can be HTTP/HTTPS url, or S3 bucket. If not provided reports are written to the console
  destination: https://some-url/ | s3://bucketname[/rootkey
traces:
  outputType: protobuf | json # Output type (defaults to protobuf)
  # Destination can be HTTP/HTTPS url, or S3 bucket. If not provided reports are written to the console
  destination: https://some-url/ | s3://bucketname[/rootkey]
```

### Generated reports structure

_TODO: Complete documentation on generated telemetry reports is in the works_

#### Response reports

Any non JSON objects in either a simple response or a HTTP response payload are not included

For example, the following will be sent without any modifications 👇

```json
{ "message": "lambda response" }
```

```json
{ "statusCode": 200, "body": "{\"message\": \"lambda response\"}" }
```

The following responses will be altered

_Simple non JSON object responses will be ignored_

| Input             | Output    |
| ----------------- | --------- |
| "Lambda response" | _Ignored_ |
| true              | _Ignored_ |
| 12                | _Ignored_ |

_HTTP Responses with a non JSON body will be ignored_

| Input                                              | Output                  |
| -------------------------------------------------- | ----------------------- |
| `{ "statusCode": 200, "body": "lambda response" }` | `{ "statusCode": 200 }` |

### Tests

Tests can only be run in context of package repository (they're not included with npm package).

See [Tests documentation](./test/README.md)
