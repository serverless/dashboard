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
