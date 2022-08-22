# Serverless Console Schema


## Building Node.js Library

### Prerequisites

1. Install `protoc`. On Mac you can run `brew install protobuf`
2. Install [buf](https://docs.buf.build/installation). On Mac you can run `brew install bufbuild/buf/buf`

### Generating Library

1. From `./proto` run `buf build && buf generate`
1. From `./node` run `npm install`
2. From `./node/packages/sdk-schema` run `npm build`

You now have a built package that you can either link locally or publish.
