from __future__ import annotations
import pytest
import json
from unittest.mock import MagicMock
from botocore.stub import Stubber


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


def test_aws_sdk_instrumentation_s3(instrumenter):
    # given
    import boto3

    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    stubber = Stubber(client)
    stubber.add_response("create_bucket", {})
    stubber.activate()

    # when
    client.create_bucket(Bucket="test-bucket")

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
    assert sdk_span.input is None
    assert sdk_span.output is None
    stubber.assert_no_pending_responses()


def test_aws_sdk_instrumentation_in_dev_mode_s3(instrumenter_dev):
    # given
    import boto3

    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    stubber = Stubber(client)
    response = {
        "ResponseMetadata": {
            "RequestId": "foo",
            "HTTPStatusCode": 200,
        },
    }
    stubber.add_response("create_bucket", response)
    stubber.activate()

    # when
    client.create_bucket(Bucket="test-bucket")

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
    assert sdk_span.tags["aws.sdk.request_id"] is not None
    assert "aws.sdk.error" not in sdk_span.tags
    assert sdk_span.input == '{"Bucket": "test-bucket"}'
    assert (
        json.loads(sdk_span.output).get("ResponseMetadata", {}).get("HTTPStatusCode")
        == 200
    )
    stubber.assert_no_pending_responses()


def test_aws_sdk_instrumentation_error(instrumenter):
    # given
    import boto3

    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    stubber = Stubber(client)
    stubber.add_client_error(
        "head_object",
        http_status_code=404,
        service_message="Not Found",
        service_error_code="404",
    )
    stubber.activate()

    # when
    import botocore

    with pytest.raises(botocore.exceptions.ClientError):
        client.head_object(Key="foo", Bucket="bar")

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
    stubber.assert_no_pending_responses()


def test_aws_sdk_instrumentation_of_dynamodb(instrumenter, monkeypatch):
    # given
    mock_report_error = MagicMock()
    import sls_sdk.lib.tags

    monkeypatch.setattr(sls_sdk.lib.tags, "report_error", mock_report_error)
    table_name = "test-table"

    import boto3

    client = boto3.client(
        "dynamodb",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    stubber = Stubber(client)
    response = {
        "ResponseMetadata": {
            "RequestId": "foo",
            "HTTPStatusCode": 200,
        },
    }
    stubber.add_response("create_table", response)
    stubber.add_response("put_item", response)
    stubber.add_response("query", response)
    stubber.add_response("delete_table", response)
    stubber.activate()

    client.create_table(
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
    client.put_item(
        TableName=table_name,
        Item={
            "country": {"S": "France"},
            "city": {"S": "Paris"},
            "type": {"S": "city"},
        },
    )

    client.query(
        TableName=table_name,
        KeyConditionExpression="#country = :country",
        ExpressionAttributeNames={"#country": "country"},
        ExpressionAttributeValues={":country": {"S": "France"}},
    )

    dynamodb = boto3.resource(
        "dynamodb",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    resource_stubber = Stubber(dynamodb.meta.client)
    resource_stubber.add_response("query", response)
    resource_stubber.activate()

    from boto3.dynamodb.conditions import Key

    list(
        dynamodb.meta.client.get_paginator("query").paginate(
            TableName=table_name,
            KeyConditionExpression=Key("country").eq("France"),
            FilterExpression=Key("type").eq("city"),
            ProjectionExpression="country, city",
        )
    )

    client.delete_table(TableName=table_name)

    # then
    mock_report_error.assert_not_called()
    dynamodb_spans = [
        s for s in instrumenter.trace_spans.root.spans if s.name.startswith("aws.sdk")
    ]
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
    stubber.assert_no_pending_responses()
    resource_stubber.assert_no_pending_responses()


def test_aws_sdk_servicequotas_instrumentation(instrumenter):
    # given
    import boto3

    client = boto3.client(
        "service-quotas",
        region_name="us-east-1",
        aws_access_key_id="foo",
        aws_secret_access_key="bar",
    )
    stubber = Stubber(client)
    response = {
        "ResponseMetadata": {
            "RequestId": "foo",
            "HTTPStatusCode": 200,
        },
    }
    stubber.add_response("list_aws_default_service_quotas", response)
    stubber.activate()

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
    stubber.assert_no_pending_responses()
