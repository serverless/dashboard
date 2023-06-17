from sls_sdk.lib.imports import internally_imported

with internally_imported():
    import json

import serverless_aws_lambda_sdk


def safe_stringify(value):
    try:
        return json.dumps(value, default=str)
    except TypeError as ex:
        serverless_aws_lambda_sdk.serverlessSdk._report_warning(
            "Detected not serializable value in AWS SDK request:\n"
            + "\tvalue: {}\n".format(value)
            + "\terror: {}".format(ex),
            "AWS_SDK_NON_SERIALIZABLE_VALUE",
        )
        return None
