from __future__ import annotations
import pytest
import boto3
import botocore
from moto import mock_s3
import json


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
