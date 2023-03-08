# Tests

## Unit tests

Unit tests are configured to be independent of any external infrastructure (AWS Lambda environment is emulated), and can be run offline

```bash
cd python/packages/aws-lambda-sdk
python3 -m venv .venv
source .venv/bin/activate

python3 -m pip install --editable .
python3 -m pip install pytest strenum
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

TODO: Link to integration tests in the node/test/python/aws-lambda-sdk folder.

## Environment variables

How extensions behave, for various testing purposes, can be tweaked with following environment variables:

### Variables handled in extension logic

- `SLS_SDK_DEBUG` - Log debug messages, of which scope is to:
- Mark certain processing points
