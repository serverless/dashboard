# Serverless SDK Schema

This is the auto generated Python package from the Serverless Protobufs. Serverless uses Protobufs as the required format for all instrumentation libraries that communicate with the Serverless Platform.

## Build
To build the sdk-schema package from source, follow these steps:

```bash
# cd to the root directory of repo
python3.9 -m venv .venv
source .venv/bin/activate
python3 -m pip install "betterproto[compiler]<3.0.0,>=2.0.0b5"

brew install bufbuild/buf/buf
cd ./proto
buf build
buf generate --template=buf.gen.python.yaml

cd ../python/packages/sdk-schema
pip install . --target=./dist
python -m build --wheel --sdist .
```

## Unit tests
To run the unit tests, replace the last two steps of the `Build` step with these:

```bash
pip install . pytest
python3 -m pytest
```
