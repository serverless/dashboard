# Benchmarks

## Tested use cases

### Success function ([`success`](../../../../../python/packages/aws-lambda-sdk/tests/fixtures/lambdas/success.py))

No-op success function. Handler takes callback and immediately invokes it with dummy payload

## Benchmark variants

### `bare`

No instrumentation (bare run with no extension layers onboard).

As there are no extensions loaded, there's no extension duration overhead introduced, and benchmark will naturally report them with zeros.

What we get is metrics from AWS report, that confirm on initialization duration, invocation duration, billed invocation duration and max memory used.

### `internal`

Internal extension which calculates and logs generated traces payload to the console

## Reported metrics

Each benchmark variant is run against 5 lambda instances.

Therefore for each metric outlined below, we get 5 numbers. Durations returned in result report are averages of those 5 values.

Internally measured durations are written by the extensions to the `stdout`, and are read (together with invocation reports as written by AWS) from CloudWatch logs.

### Observed AWS Lambda execution lifecycle phases

#### Initialization (`init`)

Lambda instance initialization

##### Observed metrics

###### `init:internal`

Duration of the internal extension initialization logic, measured internally in internal extension. It's a time measured from start of the internal extension logic, until it returns for further evaluation by AWS runtime engine.

###### `init:total`

Total initialization time as reported by AWS (with `initDuration` metric provided in report of the first invocation)

#### Invocation

Benchmarks observe first invocation (`first`) (one that in regular circumstances immediately follows initialization), and the the second (`following`).

Two first invocations are observed separately, as data shows that durations of first invocation are always worse than of the second, and that for the following (third, fourth etc.) invocations numbers are similar as for the second.

##### Observed metrics

###### `[first|following]:internal:request`

Invocation request handing duration in context of the internal extension. It's a time that's measured from the moment when our handler wrapper received an invocation event from AWS until we invoke the original Lambda handler.

###### `[first|following]:internal:response`

Invocation response handling duration in the context of the internal extension. It's a time that's measured from the moment when original handler provided response until we pass it back to AWS.

###### `[first|following]:total`

Total duration time as reported by AWS (with `duration` metric provided in invocation report)

###### `[first|following]:billed`

Billed duration time as reported by AWS (with `billedDuration` metric provided in invocation report)

###### `[first|following]:local

Locally measured SDK invocation time. This value is largely influenced by the location from which we run benchmarks and quality of the internet connection.

For benchmarks run against `us-east-1` region, shortest values we'll get e.g. in New York, but running benchmarks in San Francisco will already add extra latency, and numbers get additionally worse, when running benchmarks from farther locations

###### `[first|following]:maxMemoryUsed

Max memory used as reported by AWS (with `maxMemoryUsed` metric provided in invocation report). It's to expose what memory overhead is introduced by the extensions

## Setup & Run

### 1. Ensure AWS credentials

_In same manner as for AWS CLI_

### 2. Configure environment variables

- `AWS_REGION` - region against which benchmarks should be run
- `SLS_ORG_ID`- Console organization id (can by dummy, as it'll be part of generated trace which otherwise is not send to console servers)
- `TEST_UID` - (optional) common name token to be used as part of generated resource names. All generated resource names will be prefixed with `test-oext-<test-uid>`. If not provided, one is generated on basis of [local machine id](https://www.npmjs.com/package/node-machine-id). Note: Script ensures that all generated resources are removed after benchmark is done
- `LOG_LEVEL` - (optional) For more verbose output `LOG_LEVEL=info` can be used

### 4. Run

Benchmark for all configured use cases and benchmark variants can be run as:

```bash
../scripts/benchmark.js
```

Generated benchmark results are output to the console in CSV format. To store them to the file output can be piped as:

```bash
../scripts/benchmark.js > benchmark.csv
```

### 4.1 Run customization

Benchmark run can additionally be customized with following CLI params

- `--use-cases` Comma separated list of function use cases to test (e.g. `callback,require`)
- `--benchmark-variants` Comma separated list of benchmark variants to test (e.g. `internal`)
- `--memory-size` Memory size to provide to lambdas (by default it's 128MB).
