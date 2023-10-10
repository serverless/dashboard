from .sdk import serverlessSdk

aws_lambda_span = serverlessSdk.trace_spans.aws_lambda


def is_api_event():
    return aws_lambda_span.tags.get("aws.lambda.event_type") in [
        "aws.apigateway.rest",
        "aws.apigatewayv2.http.v1",
        "aws.apigatewayv2.http.v2",
        "aws.lambda.url",
        "aws.elasticloadbalancing.http",
    ]


def is_api_gateway_v2_event():
    return (
        aws_lambda_span.tags.get("aws.lambda.event_type") == "aws.apigatewayv2.http.v2"
    )
