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
4. `python3 -m pip install "betterproto[compiler]<3.0.0,>=2.0.0b5"`
5. `cd ./proto`
6. `buf build`
7. `buf generate --template=buf.gen.python.yaml`
8. `cd ../python/packages/sdk-schema`
9. `pip install . --target=./dist`
10. `python -m build --wheel --sdist .`

You now have a built package that can be published. For more details, see [sdk-schema/README.md](../python/packages/sdk-schema/README.md).
