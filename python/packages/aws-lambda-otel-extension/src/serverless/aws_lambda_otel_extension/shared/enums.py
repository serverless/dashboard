from enum import Enum


class ExtensionEventType(Enum):
    Invoke = "INVOKE"
    Shutdown = "SHUTDOWN"


class ExtensionResponseEventType(Enum):
    Invoke = "EventInvoke"
    Shutdown = "EventShutdown"


class LambdaEventType(Enum):
    AlexaSkill = "aws.alexaskill"
    APIGateway = "aws.apigateway.http"
    APIGatewayV2 = "aws.apigatewayv2.http"
    CloudFront = "aws.cloudfront"
    CloudWatchLog = "aws.cloudwatch.log"
    CloudWatchEvent = "aws.cloudwatch.event"
    CustomAuthorizer = "aws.apigateway.authorizer"
    DynamoDB = "aws.dynamodb"
    Firehose = "aws.firehose"
    Kinesis = "aws.kinesis"
    S3 = "aws.s3"
    Scheduled = "aws.scheduled"
    SES = "aws.ses"
    SNS = "aws.sns"
    SQS = "aws.sqs"
