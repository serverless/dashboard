# Serverless Console Schema


## Building Node.js Library

### Prerequisites

1. Install `protoc`. On Mac you can run `brew install protobuf`
2. Install [buf](https://docs.buf.build/installation). On Mac you can run `brew install bufbuild/buf/buf`

### Generating Library

1. From `./proto` run `buf build & buf generate`
1. From `./node` run `npm install`
2. From `./node/packages/sdk-schema` run `npm run build`

You now have a built package that you can either link locally or publish.

## Building Python Library

### Prerequisites

1. Install `protoc`. On Mac you can run `brew install protobuf`
2. Install [buf](https://docs.buf.build/installation). On Mac you can run `brew install bufbuild/buf/buf`

### Generating Library

1. cd to the root directory of the repo
2. `python3.9 -m venv .venv`
3. `source .venv/bin/activate`
4. `cd ./proto`
5. `buf build`
6. `buf generate --template=buf.gen.python.yaml`
7. `cd ../python/packages/sdk-schema`
8. `pip install . --target=./dist`
9. `python -m build --wheel --sdist .`

You now have a built package that can be published. For more details, see [sdk-schema/README.md](../python/packages/sdk-schema/README.md).
