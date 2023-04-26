# Tests

## Unit tests

Unit tests are configured to be independent of any external infrastructure (AWS Lambda environment is emulated), and can be run offline

```bash
cd python/packages/aws-lambda-sdk
python3 -m venv .venv
source .venv/bin/activate

python3 -m pip install --editable '.[tests]'
python3 -m pytest
```

To run against local version of `sdk` & `sdk-schema`, install them from the local repository as:

```
...
python3 -m pip install --editable ../sdk
python3 -m pip install --editable ../sdk-schema
python3 -m pip install --editable .
...
```

## Integration tests

Integration tests are run through the node package, using [integration.test.js](/node/test/python/aws-lambda-sdk/integration.test.js).

AWS account is needed to run integration tests, and AWS credentials need to be configured.

In tests, the home folder is mocked, therefore AWS access cannot be reliably set up via the `AWS_PROFILE` variable or any other means that rely on configuration placed in the home folder. That's why credentails should be set through environment variables as listed below. Set the following environment variables before running the test:
* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`
* `SLS_ORG_ID` (can be set to "test")

Tests create a temporary layer and Lambda resources and remove them after the test is finalized.

All created resourced are named or prefixed with `test-sdk-<testUid>` string, where `testUid` is four characters taken from [local machine id](https://www.npmjs.com/package/node-machine-id) or in case of CI runs a random string. `testUid` string can also be overridden via environment variable `TEST_UID`.

The Python code subject to test, which will be packaged as a lambda layer, should be built in the `python/packages/aws-lambda-sdk/dist` folder. You can choose where to pull the dependencies from, they might be pulled from PyPI repository or you can use dependencies from the local repository.

### Before building
* Remove the target `dist` folder to make sure packages from previous runs do not interfere: `rm -rf python/packages/aws-lambda-sdk/dist`

### A. Build code from PyPI repository

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install serverless-aws-lambda-sdk --target=python/packages/aws-lambda-sdk/dist
```

### B. Build code from local repository
```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install python/packages/sdk --target=python/packages/aws-lambda-sdk/dist
python3 -m pip install python/packages/sdk-schema --target=python/packages/aws-lambda-sdk/dist
python3 -m pip install python/packages/aws-lambda-sdk --target=python/packages/aws-lambda-sdk/dist
```

### C. Build Lambda SDK from local repository, but base SDK from PyPI repository
```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install python/packages/aws-lambda-sdk --target=python/packages/aws-lambda-sdk/dist
```

### Running the tests
```bash
cd node
npm install
npx mocha test/python/aws-lambda-sdk/integration.test.js
```

## Environment variables

How extensions behave, for various testing purposes, can be tweaked with following environment variables:

### Variables handled in extension logic

- `SLS_SDK_DEBUG` - Log debug messages, of which scope is to:
- Mark certain processing points
