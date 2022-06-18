# Benchmarks

## Coverage

Current version benchmarks following functions:

- Bare function [`success-callback`](../../fixtures/lambdas/success-callback.js)
- Basic express endpoint [`success-callback-express`](../../fixtures/lambdas/success-callback-express.js)
- Heavy logging function [`success-callback-logger`](../../fixtures/lambdas/success-callback-logger.js) - logs 1000 individual log messages

Against following scenarios:

- `bare` - No instrumentation (bare run with no layer attached)
- `external-only` - Just external extension which handles lambda event cycle, as no internal extension is loaded, no reports are processed
- `to-log` - External & internal extension but with reports being logged to the stdout (doesn't involve communication with external server)
- `to-console` - (If `SLS_ORG_NAME` & `SLS_ORG_TOKEN` env vars are set) External & internal extension reporting to the Console Kinesis server.

## Provided results

Each scenario (function + instrumentation setup case) is evaluated 5 times, and that consist of:

- Function creation
- First function invocation
- Second function invocation

There's 2s gap between function invocations, to ensure we test against single lambda instance.

For each scenario, multiple duration metrics (described below) are observed, they are read from CW logs, have their median calculated (out of five occurances) and are written to the outcome CSV output

### Initialization durations

- `init:external` - Measured internally, external extension initialization overhead
- `init:internal` - Measured internally, internal extension initialization overhead
- `init:aws` - `initDuration`, as provided by AWS in function report

### Invocation durations

Those are split into two `first` and `following`, as first invocation (putting aside initialization phase) also often implies some initialization overhead (obtained numbers show it should not be measured as equal to following invocations)

- `[first|following]:internal:request` - Measured internally, internal extension request processing overhead (time between receiving the event from AWS and passing it to original handler)
- `[first|following]:internal]:response` - Measured internally, internal extension response processing overhead (time between receiving the reponse from original handler, and returning it to AWS)
- `[first|following]:external:response` - Measured internally, time between lambda invocation being closed, and external extension marking itself ready for next invocation
- `[first|following]:aws:duration` - `duration` as provided by AWS in function report
- `[first|following]:aws:billedDuration` - `billedDuration` as provided by AWS in function report
- `[first|following]:loca]:duration` - Duration of AWS SDK invocation request as observed locally
- `[first|following]:aws:maxMemoryUsed` - `maxMemoryUsed` as provided by AWS in function report

## Setup

### 1. Ensure all dependencies are installed:

Run `npm install` in following folders:

- `external/otel-extension-external`
- `internal/otel-extension-internal-node`
- `test/fixtures/lambdas`

### 2. Ensure AWS credentials

### 3. Configure environment variables

- `AWS_REGION` - region in which benchmarked lambds need to be deployed
- `SLS_ORG_NAME` & `SLS_ORG_TOKEN`- (optional) Needed to benchmark scenario of reporting to the Console Kinesis server
- `TEST_UID` - (optional) common name token to be used as part of genered resource names. All generated resource names will be prefixed with `test-oext-<test-uid>`. If not provided, one is generated on basis of [local machine id](https://www.npmjs.com/package/node-machine-id). Note: Script ensures that all genereated resources are removed after benchmark is done
- `LOG_LEVEL` - (optional) For more verbose output `LOG_LEVEL=info` can be used

## Run

```bash
./test/scripts/benchmark.js
```

Generated benchmark results are output to the console in CSV format. To store them to the file output can be piped as:

```bash
./test/scripts/benchmark.js > benchmark.csv
```
