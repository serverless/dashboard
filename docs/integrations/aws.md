<!--
title: AWS
menuText: AWS
description: AWS Integration
menuOrder: 2
-->

# AWS Integration

## Adding your AWS Account

Once you have created an org in Serverless Console you will be asked to add an
AWS Account as a new Integration.

It takes several minutes for the integration to complete as it performs a number
of steps:

1. Creates a set of IAM Roles using CloudFormation. These roles are used to
create additional infrastructure needed in your account.
2. Creates an EventBridge Event Bus and CloudTrial Event Trail for handling
Lambda deploy events. This is used by Serverless Console to ensure functions are
instrumented upon deployment.
3. Creates a CloudWatch Metric Stream for collection metrics.
4. Creates two Kinesis Firehoses for sending logs and metrics to Serverless
Consoles.

Note: this same process can be initiated from the CLI using [Serverless Framework](../)

## Integration Status

Once you have initiated the creation CloudFormation stack the process will take
a few minutes and the status of your integration will be one of the following.

**Running** - The integration has setup the initial infrastructure, and it is 
currently syncing the resources. In addition to initial syncing of resources,
the integration may later appear as running when periodic syncing occurs.

**Complete** - A complete integration has all infrastructure in place and 
inventory is up to date.

**Incomplete** - An incomplete integration is missing infrastructure and may or
may not have accurate inventory information. You will need to delete this
integration or contact support.

## Environment and Namespace Tags

During the initial sync Serverless Console will identify all Lambda functions
and CloudFormation stacks to help determine a helpful Environment, and Namespace
value.

The **Environment** is determined by the Lambda env var `STAGE`, it represents
the app environment, like `development` or `production`. To set the Environment
go to Settings -> Integrations -> Edit Integration. Each function will have the
ability to select a pre-populated Environment tag, or to create a new one.

The **Namespace** is determined from the `service` name specified in
CloudFormation, it represents a common business outcome, like `shopping-cart`.
To set the Namespace tag go to Settings -> Integrations -> Edit Integration.
Each function will have the ability to select a pre-populated set of Namespaces
or add a new one. Only one namespace tag can be added per function. 

## AWS Account Infrastructure Updates and Data Collection

The following is an overview of the changes Serverless Console makes to your
AWS Infrastructure, including IAM Roles, and the data it collects, when you add
an AWS Integration.

### IAM Roles

Serverless Console configures three IAM Roles when adding your AWS Account.
Where possible the least privileges are applied and [detailed comments](https://github.com/serverless/console/blob/main/instrumentation/aws/iam-role-cfn-template.yaml)
are maintained about the permissions.

- `ServerlessRole` - The primary role used for the setting up general
infrastructure.
- `ServerlessEventSubscriptionExecutionRole` - Configures EventBridge for
processing new CloudTrail events.
- `ServerlessMonitoringRole` - Creates required Kinesis Firehose instances and
CloudWatch Metric Stream.

### CloudTrail Events

Serverless Console use CloudTrial for identify updates to resources and enabling
instrumentation on those resources if necessary. An EventBridge rule is setup
in each region where instrumented resources exist. 

### Metric Streams

Serverless Console collects metrics for all your Lambda functions using
[Cloudwatch Metric Streams](https://aws.amazon.com/blogs/aws/cloudwatch-metric-streams-send-aws-metrics-to-partners-and-to-your-apps-in-real-time/). 

Currently metric streams are limited to collect metrics from Lambda, and API
Gateway. A unique metric stream and Kinesis Firehose is created in each region
you have instrumented resources.

### CloudWatch Log Subscriptions

When you enable instrumentation for a function, Serverless Console will setup
a [Cloudwatch Subscription](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Subscriptions.html)
to collect logs for that function. Cloudwatch Subscriptions are configured in
the region your function is deployed.

### Lambda Layer with Dev Mode Instrumentation Extension

When Dev Mode instrumentation is enabled, an AWS Lambda Layer with an external
extension is added to the function. This extension is responsible for collecting
the trace details, logs, events, and forwarding them to Serverless Console.
This extension enables the real-time logging in DevMode by skipping CloudWatch
Logs.

Currently this is limited to Node.js 12+ runtime only. 

### Lambda Layer with the Serverless SDK

When Dev or Prod mode instrumentation is enabled, an AWS Lambda Layer with the
Serverless SDK is added to the function. The Serverless SDK is responsible for
auto-instrumentation of traces and spans and collecting events.

The traces, spans, and events are binary encoded and logged in CloudWatch
where Serverless Console can consume the events via CloudWatch log subscription
groups.

Currently this is limited to the Node.js 12+ runtime only. Support for Python
and Go runtimes is coming soon.

### Automatic updating of AWS Lambda Layers

If instrumentation is enabled on a function and a new version of the lambda
layers is released, the layers on the AWS Account will automatically be upgraded
to the latest version. No manual intervention or redeployment is necessary.

## Automatically removing an AWS Integration

It is best to use the Console UI to remove any AWS Accounts you have setup.
This automates the process of removing all associated infrastructure in your
account.

## Manually removing an AWS Integration

It is recommended to use the automatic AWS Integration removal process; however,
it is also possible to remove the integration manually.

1. Remove the IAM Roles - Go to your [IAM Roles in AWS Console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/roles)
and delete the roles `ServerlessRole`,
`ServerlessEventSubscriptionExecutionRole` and `ServerlessMonitoringRole`.

1. Remove the CloudFormation Stack - Go to your [CloudFormation Stacks in AWS Console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringStatus=active&filteringText=&viewNested=true&hideStacks=false).
Look for the stack named `Serverless-Inc-Role-Stack` and delete it. This stack
is only created in `us-east-1`. 

1. Remove the Kinesis Firehose - Go to [Kinesis Delivery Streams in AWS Console](https://us-east-1.console.aws.amazon.com/firehose/home?region=us-east-1#/streams)
and delete the delivery streams named `serverless_logs-firehose` and
`serverless_metrics-firehose`. You will need to repeat this for each region in
which Lambda functions were instrumented with Serverless Console.
 
1. Remove the Cloudwatch Metric Streams - Go to [Cloudwatch MetricStreams in AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metric-streams:streamsList)
and delete the metric stream name `serverless_metrics-stream`. You will need to
repeat this for each region in which Lambda functions were instrumented with
Serverless Console.

1. Remove the CloudTrail Trail - Go to [CloudTrail Trails in AWS Console](https://us-east-1.console.aws.amazon.com/cloudtrail/home?region=us-east-1#/trails)
and delete the rule `serverless_trail`. You will need to repeat this for each
region in which Lambda functions were instrumented with Serverless Console.

1. Remove the EventBridge rule - Go to the [EventBridge rules in AWS Console](https://us-east-1.console.aws.amazon.com/events/home?region=us-east-1#/rules)
and delete the rule `serverless_lambda_deploy_events`. You will need to repeat
this for each region in which Lambda functions were instrumented with Serverless
Console.

1. Remove s3 bucket - Go to the [S3 Buckets in AWS Console](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1)
and delete the buckets named `serverless.logs-firehose-backup-GUID` and
`serverless.metrics-firehose-backup-GUID`. You will need to repeat this for each
region in which Lambda functions were instrumented with Serverless Console.

1. Remove the Cloudwatch Log Subscriptions - Go the your [Cloudwatch Log Groups in the AWS Console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups).
Open Log Group (the function name will appear in the Log Group path). Under the
Log Group click on the `Subscription Filters` tab and remove the delete the
filter name `serverless_logs-filter`. You will need to repeat this for each
Lambda functions instrumented with Serverless Console.

1. Remove the Layers and env vars - Go to your [Lambda functions in AWS Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions).
Go to the Lambda function and go to the Layers section of the function and
delete the layers with `sls-sdk-node` and `sls-external-extension`. Under
Configuration -> Environment Variables remove the environment variables
`AWS_LAMBDA_EXEC_WRAPPER`, `SLS_DEV_MODE_ORG_ID` and `SLS_ORG_ID`. You will need
to repeat this for each Lambda functions instrumented with Serverless Console.
