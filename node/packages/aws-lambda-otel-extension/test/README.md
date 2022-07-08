# Tests

## Unit tests

Unit tests are configured to be independent of any external infrastructure (AWS Lambda environment is emulated), and can be run offline

```bash
npm test
```

## Integration tests

AWS account is needed to run integration tests, and AWS credentials need to be configured.

In tests, the home folder is mocked, therefore AWS access cannot be reliably set up via the `AWS_PROFILE` variable or any other means that rely on configuration placed in the home folder.

Easiest is to run tests is by setting `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.

Tests create a temporary layer and Lambda resources and remove them after the test is finalized.

All created resourced are named or prefixed with `test-otel-extension-<testUid>` string, where `testUid` is four characters taken from [local machine id](https://www.npmjs.com/package/node-machine-id) or in case of CI runs a random string. `testUid` string can also be overriden via environment variable `TEST_UID`

```bash
npm run test:integration
```

## Performance tests

Both AWS credentials Serverless Console credentials are needed to run performance test.

Test confirms on performance of the extension instrumentation. Specifically they validate whether introduced initialization and invocation duration overhead doesn't go beyond agreed threshold.

Same as in case of integration tests, home folder is mocked, so AWS credentials cannot be set via `AWS_PROFILE` (easiest it to provide them via `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`).

Console credentials need to be provided with following environment variables:

- `SLS_ORG_NAME` - Name of the organization
- `SLS_ORG_TOKEN` - Authentication org token, which can be obtained for given organization in Console UI

Otherwise characteristic of test is very same as in case of integration tests (please follow it's documentation)

```bash
npm run test:performance
```

## Environment variables

How extensions behave, for various testing purposes, can be tweaked with following environment variables:

- `SLS_DEBUG_EXTENSION` - Log debug messages, of which scope is to:
  - Mark certain processing points
  - Log payloads which are send between extensions and to the external ingestion server
  - Report durations overhead that extension introduces
- `SLS_TEST_EXTENSION_INTERNAL_LOG` - In context of the internal extension, log payloads instead of sending them to the external extension
- `SLS_TEST_EXTENSION_EXTERNAL_NO_EXIT` - In context of the external extension, do not exit the process after shutdown phase
- `SLS_TEST_EXTENSION_REPORT_TYPE` - Set to `json` to pass reports in direct JSON format instead of Protobuf
- `SLS_TEST_EXTENSION_REPORT_DESTINATION` - Telemetry reports normally are sent to the Console ingestion servers, with this variable this can be overriden:
  - Set to `s3://<bucket>//<root-key>` to send reports to S3 bucket
  - Set to `log` to just log reports into process stdout
