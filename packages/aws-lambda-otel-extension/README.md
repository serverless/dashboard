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

_Note: pre-build layer artifacts are published with `@serverless/aws-lambda-otel-extension-dist` package, and instead of building it manually (as documented below) it is advised to rely on them instead._

```sh
# Ensure layer dependencies are installed
cd opt/otel-extension
npm install

# Build artifact
cd ../../
npm run build
```

Artifact is generated into `dist/extension.zip` file

#### 2. Publish layer

Publish layer artifact to your AWS account

#### 3. Attach layer to target Lambda and configure necessary environment variables

Ensure that layer version ARN is listed in Lambda layers.

Ensure that internal extension of a layer is pre-loaded by configuring `AWS_LAMBDA_EXEC_WRAPPER` environment variable with `/opt/otel-extension/internal/exec-wrapper.sh`

##### Configure destination endpoints of telemetry payloads

Generated payload can be propagated to the following destinations:

_At this point, only one destination type can be configured, but that's subject to change in the future_

###### External server

Configure following environment variables with designated server urls:

- `SLS_OTEL_REPORT_METRICS_URL` (to obtain [traces](https://opentelemetry.io/docs/concepts/data-sources/#traces))
- `SLS_OTEL_REPORT_TRACES_URL` (to obtain [metrics](https://opentelemetry.io/docs/concepts/data-sources/#metrics))
- `SLS_OTEL_REPORT_LOGS_URL` (to obtain [logs](https://opentelemetry.io/docs/concepts/data-sources/#logs))

Additionally, through `SLS_OTEL_REPORT_REQUEST_HEADERS` environment variable, extra request headers can be configured, that will be sent with every request to each of the configured urls

###### S3 bucket

Configure `SLS_OTEL_REPORT_S3_BUCKET` with bucket name (and ensure that Lambda has needed rights to write to the bucket)

###### Inline logs

For development purposes, just logging the reports may be good enough. It'll be the case if neither `SLS_OTEL_REPORT_<type>_URL` nor `SLS_OTEL_REPORT_S3_BUCKET` environment variables are configured.

Just _metrics_ and _traces_ are logged by default. To also log reports of _lambda logs_ set the `SLS_TEST_PRINT_LOG_EVENT` environment variable to `1`.

##### Payload format

Payloads, by default are serialized into Protocol buffer format, but the format can be changed to JSON by setting `SLS_OTEL_REPORT_TYPE` environment variable to `json`

##### Monitoring configuration

What data is monitored and collected during invocation can be fine tuned with setting transported via `SLS_OTEL_USER_SETTINGS` environement variable. Value is expected to be serialized JSON object.

Following configuration properties are supported:

- `disableLogsMonitoring`: Do not collect and monitor regular function logs
- `disableRequestResponseMonitoring` - Do not propagate request (event payload) and lambda response values

### Tests

#### Unit tests

Unit tests are configured to be independent of any external infrastructure (AWS Lambda environment is emulated).

```bash
npm test
```

#### Integration tests

AWS account is needed to run integration tests, and AWS credentials need to be configured.

In tests, the home folder is mocked, therefore AWS access cannot be reliably set up via the `AWS_PROFILE` variable or any other means that rely on configuration placed in the home folder.

Easiest is to run tests is by setting `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.

Tests create a temporary layer, S3, and Lambda resources and remove them after the test is finalized.

```bash
npm run test:integration
```
