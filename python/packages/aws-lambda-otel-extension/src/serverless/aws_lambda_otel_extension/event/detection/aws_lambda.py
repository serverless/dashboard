from typing import Any, Dict, Optional

from serverless.aws_lambda_otel_extension.shared.enums import LambdaEventType


def is_event_alexa_skill(event: Dict, context: Any) -> bool:
    event_session = event.get("session", {})
    event_context = event.get("context", {})
    event_request = event.get("request", {})
    return all(
        [
            "attributes" in event_session,
            "user" in event_session,
            "System" in event_context,
            "requestId" in event_request,
        ]
    )


def is_event_api_gateway_v2(event: Dict, context: Any) -> bool:
    event_version = event.get("version")
    return all(
        [
            "rawPath" in event,
            "headers" in event,
            "requestContext" in event,
            "routeKey" in event,
            event_version == "2.0",
        ]
    )


def is_event_api_gateway(event: Dict, context: Any) -> bool:
    return all(
        [
            "path" in event,
            "headers" in event,
            "requestContext" in event,
            "resource" in event,
            "httpMethod" in event,
        ]
    )


def is_event_cloudfront(event: Dict, context: Any) -> bool:
    event_first_record = (event.get("records") or [{}])[0]
    return all(
        [
            "cf" in event_first_record,
        ]
    )


def is_event_cloudwatch_event(event: Dict, context: Any) -> bool:
    return all(
        [
            "source" in event,
            "detail" in event,
        ]
    )


def is_event_cloudwatch_logs(event: Dict, context: Any) -> bool:
    return all(
        [
            "data" in event.get("awslogs", {}),
        ]
    )


def is_event_custom_authorizer(event: Dict, context: Any) -> bool:
    event_type = event.get("type")
    return all(
        [
            "methodArn" in event,
            event_type in ["TOKEN", "REQUEST"],
        ]
    )


def is_event_dynamodb(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:dynamodb",
        ]
    )


def is_event_kinesis(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:kinesis",
        ]
    )


def is_event_firehose(event: Dict, context: Any) -> bool:
    return all(
        [
            "deliveryStreamArn" in event,
            "kinesisRecordMetadata" in (event.get("Records") or [{}])[0],
        ]
    )


def is_event_s3(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:s3",
        ]
    )


def is_event_ses(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:ses",
        ]
    )


def is_event_sns(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:sns",
        ]
    )


def is_event_sqs(event: Dict, context: Any) -> bool:
    event_first_record_event_source = (event.get("Records") or [{}])[0].get("eventSource")
    return all(
        [
            event_first_record_event_source == "aws:sqs",
        ]
    )


def is_event_scheduled(event: Dict, context: Any) -> bool:
    event_source = event.get("source")
    return all(
        [
            event_source == "aws.events",
        ]
    )


def detect_aws_lambda_event_type(event: Dict, context: Any) -> Optional[LambdaEventType]:

    if is_event_alexa_skill(event, context):
        return LambdaEventType.AlexaSkill
    if is_event_api_gateway_v2(event, context):
        return LambdaEventType.APIGatewayV2
    if is_event_api_gateway(event, context):
        return LambdaEventType.APIGateway
    if is_event_cloudfront(event, context):
        return LambdaEventType.CloudFront
    if is_event_cloudwatch_event(event, context):
        return LambdaEventType.CloudWatchEvent
    if is_event_cloudwatch_logs(event, context):
        return LambdaEventType.CloudWatchLog
    if is_event_custom_authorizer(event, context):
        return LambdaEventType.CustomAuthorizer
    if is_event_dynamodb(event, context):
        return LambdaEventType.DynamoDB
    if is_event_kinesis(event, context):
        return LambdaEventType.Kinesis
    if is_event_firehose(event, context):
        return LambdaEventType.Firehose
    if is_event_s3(event, context):
        return LambdaEventType.S3
    if is_event_ses(event, context):
        return LambdaEventType.SES
    if is_event_sns(event, context):
        return LambdaEventType.SNS
    if is_event_sqs(event, context):
        return LambdaEventType.SQS

    # Make sure this is last
    if is_event_scheduled(event, context):
        return LambdaEventType.Scheduled

    return None
