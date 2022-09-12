# Dev Mode Integration Tests

AWS account is needed to run integration tests, and AWS credentials need to be configured.

In tests, the home folder is mocked, therefore AWS access cannot be reliably set up via the `AWS_PROFILE` variable or any other means that rely on configuration placed in the home folder.

Easiest is to run tests is by setting `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.

Tests create a temporary layer and Lambda resources and remove them after the test is finalized.

All created resourced are named or prefixed with `test-dev-mode-<testUid>` string, where `testUid` is four characters taken from [local machine id](https://www.npmjs.com/package/node-machine-id) or in case of CI runs a random string. `testUid` string can also be overridden via environment variable `TEST_UID`

> There is a test command in the root `node` folder you use to run these tests. So if you are in this directory be sure to back out to the `node`` folder and run the following command.

```bash
npm run test:integration
```

## Environment variables

How extensions behave, for various testing purposes, can be tweaked with following environment variables:

### Variables handled in extension logic

- `SLS_TEST_EXTENSION_LOG` - Log forwarded logs to Cloudwatch

### Variables handled by test suite

- `TEST_EXTERNAL_LAYER_FILENAME` - Path to `.zip` file of a layer which contains just external dev-mode extension.
