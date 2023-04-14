import json
import serverless_aws_lambda_sdk


def safe_stringify(value):
    try:
        return json.dumps(value)
    except TypeError as ex:
        serverless_aws_lambda_sdk.serverlessSdk._report_warning(
            "Detected not serializable value in AWS SDK request:\n"
            + "\tvalue: {}\n".format(value)
            + "\terror: {}".format(ex),
            "AWS_SDK_NON_SERIALIZABLE_VALUE",
        )
        return None
