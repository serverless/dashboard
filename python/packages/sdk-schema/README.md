# Serverless SDK Schema

This is the auto generated Python package from the Serverless Protobufs. Serverless uses Protobufs as the required format for all instrumentation libraries that communicate with the Serverless Platform.

## Build
To build the sdk-schema package from source, follow these steps:

```bash
brew install bufbuild/buf/buf
cd ./proto
buf build
buf generate --template=buf.gen.python.yaml

cd ../python/packages/sdk-schema
python3.9 -m venv .venv
source .venv/bin/activate
pip install . --target=./dist
python -m build --wheel --sdist .

```