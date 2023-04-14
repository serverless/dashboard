import logging
import os
import time
import boto3

s3_client = boto3.client("s3")
sqs = boto3.client("sqs")
sns = boto3.client("sns")
lambda_client = boto3.client("lambda")
ssm = boto3.client("ssm")
dynamodb = boto3.client("dynamodb")
sts = boto3.client("sts")

invocation_count = 0


def _sqs():
    queue_name = f"{os.environ.get('AWS_LAMBDA_FUNCTION_NAME')}-{invocation_count}.fifo"
    queue = sqs.create_queue(QueueName=queue_name, Attributes={"FifoQueue": "true"})
    queue_url = queue.get("QueueUrl")
    sqs.send_message(
        QueueUrl=queue_url,
        MessageBody="test",
        MessageGroupId=str(int(time.time() * 1000)),
        MessageDeduplicationId=str(int(time.time() * 1000)),
    )
    sqs.delete_queue(QueueUrl=queue_url)


def _sns():
    topic_name = f"{os.environ.get('AWS_LAMBDA_FUNCTION_NAME')}-{invocation_count}"
    topic = sns.create_topic(Name=topic_name)
    topic_arn = topic.get("TopicArn")
    sns.publish(TopicArn=topic_arn, Message="test")
    sns.delete_topic(TopicArn=topic_arn)


def _dynamodb():
    table_name = f"{os.environ.get('AWS_LAMBDA_FUNCTION_NAME')}-{invocation_count}"
    table = dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "id", "KeyType": "HASH"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "id", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    while table.get("Table", {}).get("TableStatus") != "ACTIVE":
        time.sleep(0.1)
        table = dynamodb.describe_table(TableName=table_name)

    dynamodb.put_item(
        TableName=table_name,
        Item={"id": {"S": "test"}},
    )
    dynamodb.query(
        TableName=table_name,
        KeyConditionExpression="#id = :id",
        ExpressionAttributeNames={"#id": "id"},
        ExpressionAttributeValues={":id": {"S": "test"}},
    )
    dynamodb.delete_table(TableName=table_name)


def handler(event, context) -> str:
    global invocation_count
    try:
        invocation_count += 1
        sts.get_caller_identity()

        try:
            lambda_client.get_function(FunctionName="not-existing")
        except Exception:
            pass

        try:
            ssm.get_parameter(Name="/not/existing")
        except Exception:
            pass

        _sqs()
        _sns()
        _dynamodb()
        return "ok"

    except Exception as ex:
        logging.info(ex)
        raise ex
