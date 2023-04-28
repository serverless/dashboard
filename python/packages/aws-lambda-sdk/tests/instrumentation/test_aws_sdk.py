from __future__ import annotations
import pytest
import boto3
import botocore
from pynamodb.models import Model
from pynamodb.attributes import UnicodeAttribute
from moto import mock_s3, mock_dynamodb, mock_servicequotas
import json
from unittest.mock import MagicMock


@pytest.fixture()
def instrumenter(reset_sdk):
    from sls_sdk import serverlessSdk, ServerlessSdkSettings

    serverlessSdk._settings = ServerlessSdkSettings()

    from serverless_aws_lambda_sdk.instrumentation.aws_sdk import (
        install,
        uninstall,
    )

    install()
    yield serverlessSdk
    uninstall()


@pytest.fixture()
def instrumenter_dev(reset_sdk_dev_mode):
    from sls_sdk import serverlessSdk, ServerlessSdkSettings

    serverlessSdk._settings = ServerlessSdkSettings()

    from serverless_aws_lambda_sdk.instrumentation.aws_sdk import (
        install,
        uninstall,
    )

    install()
    yield serverlessSdk
    uninstall()


@mock_s3
def test_aws_sdk_instrumentation(instrumenter):
    # given
    conn = boto3.resource("s3", region_name="us-east-1")

    # when
    conn.create_bucket(Bucket="test-bucket")

    # then
    sdk_span = [
        s for s in instrumenter.trace_spans.root.spans if s.name.startswith("aws.sdk")
    ][0]

    assert sdk_span.name == "aws.sdk.s3.createbucket"
    assert sdk_span.tags["aws.sdk.service"] == "s3"
    assert sdk_span.tags["aws.sdk.operation"] == "createbucket"
    assert sdk_span.tags["aws.sdk.signature_version"] == "v4"
    assert sdk_span.tags["aws.sdk.region"] == "us-east-1"
    assert "aws.sdk.error" not in sdk_span.tags
    assert sdk_span.tags["aws.sdk.request_id"] is not None
    assert sdk_span.input is None
    assert sdk_span.output is None


@mock_s3
def test_aws_sdk_instrumentation_in_dev_mode(instrumenter_dev):
    # given
    conn = boto3.resource("s3", region_name="us-east-1")

    # when
    conn.create_bucket(Bucket="test-bucket")

    # then
    sdk_span = [
        s
        for s in instrumenter_dev.trace_spans.root.spans
        if s.name.startswith("aws.sdk")
    ][0]

    assert sdk_span.name == "aws.sdk.s3.createbucket"
    assert sdk_span.tags["aws.sdk.service"] == "s3"
    assert sdk_span.tags["aws.sdk.operation"] == "createbucket"
    assert sdk_span.tags["aws.sdk.signature_version"] == "v4"
    assert sdk_span.tags["aws.sdk.region"] == "us-east-1"
    assert "aws.sdk.error" not in sdk_span.tags
    assert sdk_span.tags["aws.sdk.request_id"] is not None
    assert sdk_span.input == '{"Bucket": "test-bucket"}'
    assert (
        json.loads(sdk_span.output).get("ResponseMetadata", {}).get("HTTPStatusCode")
        == 200
    )


@mock_s3
def test_aws_sdk_instrumentation_error(instrumenter):
    # given
    conn = boto3.resource("s3", region_name="us-east-1")
    bucket = conn.create_bucket(Bucket="test-bucket")

    # when
    with pytest.raises(botocore.exceptions.ClientError):
        bucket.download_file("foo", Filename="bar")

    # then
    sdk_span = [
        s
        for s in instrumenter.trace_spans.root.spans
        if s.name.startswith("aws.sdk.s3.headobject")
    ][0]

    assert sdk_span.name == "aws.sdk.s3.headobject"
    assert sdk_span.tags["aws.sdk.service"] == "s3"
    assert sdk_span.tags["aws.sdk.operation"] == "headobject"
    assert sdk_span.tags["aws.sdk.signature_version"] == "v4"
    assert sdk_span.tags["aws.sdk.region"] == "us-east-1"
    assert (
        sdk_span.tags["aws.sdk.error"]
        == "An error occurred (404) when calling the HeadObject operation: Not Found"
    )
    assert sdk_span.tags["aws.sdk.request_id"] is not None
    assert sdk_span.input is None
    assert sdk_span.output is None


@mock_dynamodb
def test_aws_sdk_instrumentation_of_dynamodb(instrumenter, monkeypatch):
    # given
    mock_report_error = MagicMock()
    import sls_sdk.lib.tags

    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock_report_error)
    table_name = "test-table"

    class LocationModel(Model):
        class Meta:
            table_name = "test-table"

        country = UnicodeAttribute(hash_key=True)
        city = UnicodeAttribute(range_key=True)

    dynamodb = boto3.client("dynamodb", region_name="us-east-1")
    dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {"AttributeName": "country", "KeyType": "HASH"},
            {"AttributeName": "city", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "country", "AttributeType": "S"},
            {"AttributeName": "city", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )

    # when
    dynamodb.put_item(
        TableName=table_name,
        Item={
            "country": {"S": "France"},
            "city": {"S": "Paris"},
            "type": {"S": "city"},
        },
    )

    dynamodb.query(
        TableName=table_name,
        KeyConditionExpression="#country = :country",
        ExpressionAttributeNames={"#country": "country"},
        ExpressionAttributeValues={":country": {"S": "France"}},
    )

    res = boto3.resource("dynamodb", region_name="us-east-1")
    from boto3.dynamodb.conditions import Key

    list(
        res.meta.client.get_paginator("query").paginate(
            TableName=table_name,
            KeyConditionExpression=Key("country").eq("France"),
            FilterExpression=Key("type").eq("city"),
            ProjectionExpression="country, city",
        )
    )

    locations = [l for l in LocationModel.query("France")]
    dynamodb.delete_table(TableName=table_name)

    # then
    mock_report_error.assert_not_called()
    dynamodb_spans = [
        s for s in instrumenter.trace_spans.root.spans if s.name.startswith("aws.sdk")
    ]
    assert [(l.country, l.city) for l in locations] == [("France", "Paris")]
    [
        "aws.sdk.dynamodb.createtable",
        "aws.sdk.dynamodb.putitem",
        "aws.sdk.dynamodb.query",
        "aws.sdk.dynamodb.query",
        "aws.sdk.dynamodb.deletetable",
    ] == [s.name for s in dynamodb_spans]
    for span in dynamodb_spans:
        assert span.tags["aws.sdk.service"] == "dynamodb"
        assert span.tags["aws.sdk.dynamodb.table_name"] == table_name

    (query1_span, query2_span) = dynamodb_spans[2:4]
    assert query1_span.tags["aws.sdk.dynamodb.key_condition"] == "#country = :country"

    assert (
        query2_span.tags["aws.sdk.dynamodb.key_condition"]
        == "{'format': '{0} {operator} {1}', 'operator': '=', 'values': ['country', 'France']}"
    )
    assert query2_span.tags["aws.sdk.dynamodb.projection"] == "country, city"
    assert (
        query2_span.tags["aws.sdk.dynamodb.filter"]
        == "{'format': '{0} {operator} {1}', 'operator': '=', 'values': ['type', 'city']}"
    )


@mock_servicequotas
def test_aws_sdk_servicequotas_instrumentation(instrumenter):
    # given
    client = boto3.client("service-quotas", region_name="us-east-1")

    # when
    client.list_aws_default_service_quotas(ServiceCode="vpc")

    # then
    sdk_span = [
        s for s in instrumenter.trace_spans.root.spans if s.name.startswith("aws.sdk")
    ][0]

    assert sdk_span.name == "aws.sdk.servicequotas.listawsdefaultservicequotas"
    assert sdk_span.tags["aws.sdk.service"] == "servicequotas"
    assert sdk_span.tags["aws.sdk.operation"] == "listawsdefaultservicequotas"
    assert sdk_span.tags["aws.sdk.signature_version"] == "v4"
    assert sdk_span.tags["aws.sdk.region"] == "us-east-1"
    assert "aws.sdk.error" not in sdk_span.tags
    assert sdk_span.tags["aws.sdk.request_id"] is not None
    assert sdk_span.input is None
    assert sdk_span.output is None
