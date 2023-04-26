# Benchmarks

## Tested use cases

### Node.js success function ([`node-success`](../../packages/aws-lambda-sdk/test/fixtures/lambdas/callback.js))

No-op Node.js success function. Handler takes callback and immediately invokes it with dummy payload

### Python success function ([`python-success`](../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas/success.py))

No-op Python success function. Handler takes callback and immediately invokes it with dummy payload

## Benchmark variants

### `bare`

No instrumentation (bare run with no extension layers onboard).

### `consoleProd`

Serverless Console production Mode: Just internal extension which calculates and logs generated traces payload to the console

### `external`

Extenal extension which processes the invocation processing flow

### `consoleOfflineDevMode`

Instrumentation operating in dev mode, yet with dummy dev mode layer (written in Node.js), which just takes payloads from the extension but doesn't send them to the Serverless Console websocket

## Reported metrics

Each benchmark variant is run against 5 lambda instances.

Therefore for each metric outlined below, we get 5 numbers. Durations returned in result report are averages of those 5 values.

Internally measured durations are written by the extensions to the `stdout`, and are read (together with invocation reports as written by AWS) from CloudWatch logs.

### Observed AWS Lambda execution lifecycle phases

#### Initialization (`init`)

Lambda instance initialization

##### Observed metrics

###### `init:external:overhead`

Internally measured external extension initilizaton time, which attributes to additional intialization latency

###### `init:internal:overhead`

Internally measured internal extension initilizaton time, which attributes to additional intialization latency

###### `init:internal:total`

Duration of the internal extension initialization logic, measured internally in internal extension. It's a time measured from start of the internal extension logic, until it returns for further evaluation by AWS runtime engine.

###### `init:total`

Total initialization time as reported by AWS (with `initDuration` metric provided in report of the first invocation)

#### Invocation

Benchmarks observe first invocation (`first`) (one that in regular circumstances immediately follows initialization), and the the second (`following`).

Two first invocations are observed separately, as data shows that durations of first invocation are always worse than of the second, and that for the following (third, fourth etc.) invocations numbers are similar as for the second.
_This difference could be attributed to how Node.js internal optimization works, where paths which were already taken usually run faster (it's to be confirmed whether we see similar differences with other runtimes)._

##### Observed metrics

###### `[first|following]:internal:request-overhead`

Internally measured internal extension invocation handling overhead. Time between custom handler triggered by the AWS runtime and original handler triggered by the instrumentation logic

###### `[first|following]:internal:response-overhead`

Internally measured internal extension invocation handling overhead. Time between response being returned by the original handler and same response being returned to AWS runtime

###### `[first|following]:external:response-overhead`

Internally measured external extension invocation handling overhead. Time between receiving information of invocation being finalized and marking the extension ready to process next invocation

###### `[first|following]:internal:total`

Internally measured total invocation time

###### `[first|following]:total`

Total duration time as reported by AWS (with `duration` metric provided in invocation report)

###### `[first|following]:billed`

Billed duration time as reported by AWS (with `billedDuration` metric provided in invocation report)

###### `[first|following]:local`

Locally measured SDK invocation time. This value is largely influenced by the location from which we run benchmarks and quality of the internet connection.

For benchmarks run against `us-east-1` region, shortest values we'll get e.g. in New York, but running benchmarks in San Francisco will already add extra latency, and numbers get additionally worse, when running benchmarks from farther locations

###### `[first|following]:maxMemoryUsed`

Max memory used as reported by AWS (with `maxMemoryUsed` metric provided in invocation report). It's to expose what memory overhead is introduced by the extensions

## Setup & Run

### 1. Ensure installed dependencies

#### 1.1 Node.js

Ensure dependencies are ensure in following folders (they can be installed via `npm install` commmand):

- `node`
- `node/packages/aws-lambda-sdk`
- `node/packages/aws-lambda-sdk/test/fixtures/lambdas`

#### 1.2 Python

Ensure dependencies for the `serverless-aws-lambda-sdk` package beign installed as:

```
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install serverless-aws-lambda-sdk --target=python/packages/aws-lambda-sdk/dist
```

#### 1.3 Go

Ensure Go is installed in the environment

### 2. Setup environment variables

#### 2.1 Ensure AWS credentials

_In same manner as for AWS CLI_

#### 2.2 Configure environment variables

- `AWS_REGION` - region against which benchmarks should be run
- `SLS_ORG_ID`- Console organization id (can by dummy, as it'll be part of generated trace which otherwise is not send to console servers)
- `TEST_UID` - (optional) common name token to be used as part of generated resource names. All generated resource names will be prefixed with `test-oext-<test-uid>`. If not provided, one is generated on basis of [local machine id](https://www.npmjs.com/package/node-machine-id). Note: Script ensures that all generated resources are removed after benchmark is done
- `LOG_LEVEL` - (optional) For more verbose output `LOG_LEVEL=info` can be used

### 3. Run

Benchmark for all configured use cases and benchmark variants can be run as:

```bash
./node/test/scripts/benchmark/index.js
```

Generated benchmark results are output to the console in CSV format. To store them to the file output can be piped as:

```bash
./node/test/scripts/benchmark/index.js > benchmark.csv
```

### 4.1 Run customization

Benchmark run can additionally be customized with following CLI params

- `--use-cases` Comma separated list of function use cases to test (e.g. `node-success,pythi`)
- `--benchmark-variants` Comma separated list of benchmark variants to test (e.g. `internal`)
- `--memory-size` Memory size to provide to lambdas (by default it's 128MB).
