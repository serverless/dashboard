
# Outstanding build issues:

- Need to migrate build to utilize docker multi-arch support compatible with Github Actions rather than `pip download`
  OR attempt to use `proot` from within Github Actions.
    - Properly installs *all* dependencies without needing special workarounds.
    - Allows us to bring in compiled bytecode to further speed up initialization.

# Outstanding dependency issues and feature requests:

*OpenTelemetry*

- Requires double wrapping instrumented aws lambda handlers in order to add attributes to span and sending event data to
  collector.

  https://github.com/open-telemetry/opentelemetry-python-contrib/issues/1140

*Python3.6*

- Warnings about the nanosecond time resolution in Python3.6

  https://github.com/open-telemetry/opentelemetry-python/blob/main/opentelemetry-api/src/opentelemetry/util/_time.py

*Python3.6 and Python3.7*

- Based on top of Amazon Linux rather than Amazon Linux 2
    - Different glibc version.
- AWS Lambda bootstrap shell script does not attempt to work with `AWS_LAMBDA_EXEC_WRAPPER`.
    - Need to set handler to `serverless_aws_lambda_otel_extension_internal.wrapper.auto_instrumenting_handler`.
    - Need to add function level environment variable `ORIG_HANDLER` and reference function here instead.

*Python3.8*

- AWS Lambda bootstrap python module uses `imp` module and does a not-so-great job of finding namespaced packages.

  Original: `src/serverless/aws_lambda_otel_extension/internal/wrapper/handler.py`
  Workaround: `src/serverless_aws_lambda_otel_extension_internal_wrapper_handler/__init__.py`

    - Referenced in `assets/internal/otel-extension-internal-python/exec-wrapper.sh`
    - Compatible with Python3.6+
    - Simply a de-namespaced wrapper module providing
      `serverless_aws_lambda_otel_extension_internal_wrapper_handler.auto_instrumenting_handler` as an easily importable path.
