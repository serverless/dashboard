<!--
title: Glossary
menuText: Glossary
description: 
menuOrder: 4
-->

# Glossary
This is a consolidated list of terms and concepts, with precise definitions, which are used within Serverless Console and the broader cloud industry.  Whenever possible, Serverless Console adopts existing industry terms, rather than create new ones.

## Organization
An organization is a single tenant in Serverless product suite (including  Dashboard, and Serverless Cloud). An organization name needs to be unique and you need to [add at least one AWS Observability Integration](./integrations/index.md#adding-the-aws-observability-integration) to start using Serverless Console. 

## Integration
Integrations are how Serverless Console keeps track of third party tools you choose to instrument and monitor. You need at least one Integration to utilize Serverless Console features and you can use add multiple Integrations to a single organization. 

## Resources
Resources are an instance of a service on which you can enable monitoring. Currently this is limited
to AWS Lambda Functions, but the set of supported resources is expected to grow over time.

### Active Resource
Active Resources is a Resources that have been active in the last 24 hour period. See our [pricing page](https://www.serverless.com/console/pricing) for more details about how we use Active Resources. 

## AWS Observability Integration
The AWS Observability Integration is a collection of infrastructure deployed and tracked by Serverless Console.  This Integration is deployed using a [Cloudformation Stack](#cloudformation-stack) and [IAM Role](./integrations/data-sources-and-roles.md#iam-roles). 

#### CloudFormation Stack
[CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) is an AWS Service which allows you to create templates for creating AWS Infrastructure. Serverless Console creates the [Serverless-Inc-Role-Stack](../integrations/aws/iam-role-cfn-template.yaml) in your account when you add the AWS Observability Integration.

#### IAM Roles
An [Identity Access Management Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) defines a set of permissions for interacting with your AWS Account. Serverless Console adds an [the ServerlessMonitoringRole](../integrations/aws/iam-role-cfn-template.yaml) to create the following additional pieces of AWS Infrastructure. 

#### Kinesis Firehose
[A Kinesis Firehose](https://aws.amazon.com/kinesis/data-firehose/) is a streaming data pipeline used to send log data to Serverless Console. 

#### Cloudwatch Log Subscription Filter
A [Cloudwatch Log Subscription Filter](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html) specifies a set of logs to be set to a destination, such as Kinesis Firehose. 

#### EventBridge

#### CloudTrail

#### Cloudwatch Metric Stream
[Cloudwatch Metric Streams](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Metric-Streams.html) are used to collect aggregate metrics. Cloudwatch Metric streams allow you to collect metrics from any AWS Services. For a list of metrics we collect, see our [metrics section](./product/metrics.md).

#### Lambda Layer
[A Lambda Layer](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html) is a packaged library for distributing Lambda Functions. The [Serverless Extension](./integrations/data-sources-and-roles.md#extensions) and [Serverless Node SDK](./integrations/data-sources-and-roles.md#serverless-node-sdk-internal-extension) are packaged as Lambda Layers and attached to your function when you [enable additional monitoring features](./integrations/enable-monitoring-features.md).

#### Serverless Extension
An AWS Lambda Extension is extra code which you can add to your AWS Lambda Function via an AWS Lambda Layer in order to track telemetry data about each Invocation.  Serverless Console uses a sophisticated AWS Lambda Extension for collecting telemetry data in AWS Lambda Functions.


## Tracing
A [Trace](./product/traces.md) is collection of Logs, Metrics, and Spans associated with an a functions initialization, invocation and shutdown phases. A Trace allows you to understand the progression of these phases and further troubleshoot slowness or errors.

### Function Initialization
Function initialization is a set of processes that happens before a Lambda Function is ready to be executed. 

* Extension Init – Initializing all External AWS Lambda Extensions configured on the function (there is a limit of 10 Extensions per function).

* Runtime Init – Initializing the AWS Lambda Runtime (e.g, Node.js, Python).

* Function Init – Initializing the AWS Lambda Function code.

Initialization only appears for the first event processed by each instance of your function, which is also known as a Cold-Start. It can also appear in advance of function invocations if you have enabled provisioned concurrency.

You will want to optimize Initialization performance as best you can. Poor Initialization performance will directly affect the experience of your users and customers. Additionally, it's important to note that AWS charges you for Initialization time. Unfortunately, no tooling can offer a breakdown of what happens within the Initialization phase of AWS Lambda. Generally, adding multiple Extensions, large code file sizes, and using a slower runtime (e.g., Java) are the biggest culprits when it comes to slow Initialization.

Once initialized, each instance of your function can process thousands of requests without performing another Initialization. However, AWS Lambda function instance containers will shutdown within 5-15 minutes of inactivity. After that, the next event will be a Cold-Start, causing Initialization to run again.

### Cold Start
When an AWS Lambda function receives a request, and it has not been used before, or for several minutes, its environment and code must first be Initialized.  This process is known as an AWS Lambda Cold-Start.  This process adds latency to the overall invocation duration.

After the execution completes, the execution environment is frozen. To improve resource management and performance, the Lambda service retains the execution environment for a non-deterministic period of time. During this time, if another request arrives for the same function, the service may reuse the environment. This second request typically finishes more quickly, since the execution environment already exists and it’s not necessary to download the code and run the initialization code. This is called a Warm-Start.

According to an analysis of production Lambda workloads, cold starts typically occur in under 1% of invocations. The duration of a cold start varies from under 100 ms to over 1 second

### Warm Start
When an AWS Lambda function instance receives a request after having received previous requests within the last few minutes. The Initialization phase does not happen and this is known as a Warm-Start.


### Handler
The handler of an AWS Lambda function is where your business logic resides.

### Function Invocation
Function invocation refers the set of processing process by your [handler](#handler) as well as any time spent processing extension behavior. 

It's important to note that your function's timeout setting limits the duration of the entire Invocation phase. For example, if you set the function timeout as 360 seconds, the function and all extensions need to complete within 360 seconds.

### Shutdown
This phase of AWS Lambda which unfortunately cannot be measured by observability tools, but must be acknowledged.  This phase is run when AWS Lambda is about to shut down the runtime.

### Timeout
A timeout is a configurable limit for the duration of your AWS Lambda.










