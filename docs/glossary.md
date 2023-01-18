<!--
title: Glossary
menuText: Glossary
description: 
menuOrder: 5
-->

# Glossary
This is a consolidated list of terms and concepts, with precise definitions, which are used within Serverless Console and the broader cloud industry.  Whenever possible, Serverless Console adopts existing industry terms, rather than create new ones.

## Organization
An organization is a single tenant in Serverless product suite (including  Dashboard, and Serverless Cloud). An organization name needs to be unique and you need to [add at least one AWS Integration](./integrations/index.md#adding-the-aws-observability-integration) to start using Serverless Console. 

## Integration
Integrations are how Serverless Console keeps track of third party tools you choose to instrument and monitor. You need at least one Integration to utilize Serverless Console features and you can use add multiple Integrations to a single organization. 

## Resources
Resources are an instance of a service on which you can enable monitoring. Currently this is limited
to AWS Lambda Functions, but the set of supported resources is expected to grow over time.

### Function
A function is an instance of an [AWS Lambda](#aws-lambda) application. Functions can be written
in a variety of languages and support a large number of runtime environments. 

### Active Resource
Active Resources is a Resources that have been active in the last 24 hour period. See our [pricing page](https://www.serverless.com/console/pricing) for more details about how we use Active Resources. 

## AWS Integration
The AWS Integration is a collection of infrastructure deployed and tracked by Serverless Console.  This Integration is deployed using a [Cloudformation Stack](#cloudformation-stack) and [IAM Role](./integrations/data-sources-and-roles.md#iam-roles). 

### AWS Lambda
AWS Lambda is a Serverless, event-driven computing environment for running Serverless applications
also known as [functions](#function). 

### Initialization
Initialization refers to the period of function execution prior to the invocation of your handler. More details on the AWS Execution environment are available in our [understanding Lambda duration guide](./product/duration.md).

#### Cold Start
A cold start is the name for a first-time initilization phase which takes longer than subsequent
initilizations. See more details in our [understanding Lambda duration guide](./product/duration.md).

#### Invocation

#### Function Handler
The handler of an AWS Lambda function is where your business logic resides. Regardless of language
or runtime all AWS Lambda functions have a Handler which corresponds to the [Invocation phase](./product/duration.md#invocation) of the execution. 

#### Function Error (Caught Exception)
Function errors are errors caught in an exception handlers you have included
in your code. It can be helpful to include function handlers in your code for known
failure points so you can find these failures in [Trace Explorer](./product/traces.md#explorer-view).

#### Function Failure (Uncaught Exception)
A function failure occurs when an error occurs that is not handled as an exception.
In these cases the function may fail to invoke. These appear on the metrics page
and are sortable on the [Trace Explorer](./product/traces.md#explorer-view).

#### Lambda Runtime
[Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-concepts.html#gettingstarted-concepts-runtime) provide a language and architecture specific environment for executing your code. 
Serverless Console works on all function regardless of functions but [enabling tracing](./integrations/enable-monitoring-features.md#enabling-traces) requires Node.14 or later.

### CloudFormation Stack
[CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) is an AWS Service which allows you to create templates for creating AWS Infrastructure. Serverless Console creates the [Serverless-Inc-Role-Stack](../integrations/aws/iam-role-cfn-template.yaml) in your account when you add the AWS Integration.

### IAM Roles
An [Identity Access Management Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) defines a set of permissions for interacting with your AWS Account. Serverless Console adds an [the ServerlessMonitoringRole](https://github.com/serverless/console/blob/main/instrumentation/aws/iam-role-cfn-template.yaml) to create the following additional pieces of AWS Infrastructure. 

### Kinesis Firehose
[A Kinesis Firehose](https://aws.amazon.com/kinesis/data-firehose/) is a streaming data pipeline used to send log data to Serverless Console. 

### Cloudwatch Log Subscription Filter
A [Cloudwatch Log Subscription Filter](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html) specifies a set of logs to be set to a destination, such as Kinesis Firehose. 

### EventBridge
[EventBridge](https://docs.aws.amazon.com/eventbridge/) is an event bus for publishing events, and is used for transporting CloudTrail events from your AWS account to Serverless Console. These events are used to track new Lambda function deployments.

### CloudTrail
[CloudTrail](https://docs.aws.amazon.com/cloudtrail/) is a service used for getting a history of
all AWS API calls in your AWS account. 

### Cloudwatch Metric Stream
[Cloudwatch Metric Streams](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Metric-Streams.html) are used to collect aggregate metrics. Cloudwatch Metric streams allow you to collect metrics from any AWS Services. For a list of metrics we collect, see our [metrics section](./product/metrics.md).

### Lambda Layer
[A Lambda Layer](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html) is a packaged library for distributing Lambda Functions. The [Serverless external extension](./integrations/data-sources-and-roles.md#extensions) and [Serverless Node SDK](./integrations/data-sources-and-roles.md#serverless-node-sdk) are packaged as Lambda Layers and attached to your function when you [enable additional monitoring features](./integrations/enable-monitoring-features.md).

### Serverless External Extension
An AWS Lambda Extension is extra code which you can add to your AWS Lambda Function via an AWS Lambda Layer in order to track telemetry data about each Invocation.  Serverless Console uses a sophisticated AWS Lambda Extension for collecting telemetry data in AWS Lambda Functions.

### Serverless Node SDK
The Serverless Node SDK is a Lambda Extension that instruments your code for specific interactions
within your [handler](#function-handler) and with other AWS Services. See more details on [supported child spans](./integrations/data-sources-and-roles.md#supported-child-spans).

## Tracing
A [Trace](./product/traces.md) is collection of Logs, Metrics, and Spans associated with an a functions initialization, invocation and shutdown phases. A Trace allows you to understand the progression of these phases and further troubleshoot slowness or errors.

### Namespace 
A namespace is a tag that can be applied to one or more of your functions to group 
functions that have related business outcomes - e.g. shopping-cart.

### Environment
Environment allows you to group functions across specific environments like development, production, etc.

### Spans
Spans are child interactions that occur within your Trace. This include the various phases
of your execution as well as more [detailed interactions](./integrations/data-sources-and-roles.md#supported-child-spans) that occur within your function. 

### Request
This is a unique id used on your trace. It is used to associate logs and metrics for a Trace.

### Arch
This is the architecture (x86_64 or ARM64) that executed the function.

###  Max Memory
This is the Max Memory in MB used by your function.

### Version 
This is the version of the function that executed.

### Outcome

### Log Group 
A log group is collection of logs organized for filtering and sorting in [CloudWatch](#cloudwatch-log-subscription-filter). 

### Log Stream Name
 This is the [log subscription filter](#cloudwatch-log-subscription-filter) we used to collect logs for this function.