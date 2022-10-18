<!--
title: Duration
menuText: Duration
description: Details about the durations shown in the Console UI 
menuOrder: 8
-->

# Duration
Understanding how Lambda Duration impact user experience and
cost is complicated to understand. This guide helps distill
key terms of the [AWS Lambda execution environment](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html), and how we use them in our product.

## Glossary

### AWS Lambda Duration

This is the Duration number from the CloudWatch `REPORT` of an AWS Lambda invocation.  It’s not the [Billed Duration](#aws-billed-duration).  This does not contain AWS Lambda’s Initialization Phase, except for in the case where the Initialization Phase fails to start-up due to an error in your code and is retried.  Then you will be billed for that time and this is added under the Initialization Phase.

```text
2022-06-13T15:06:51.041-07:00   REPORT RequestId: a9fa9a-819a-19a9-faia-afu891asf	Duration: 480.41 ms	Billed Duration: 481 ms	Memory Size: 1024 MB	Max Memory Used: 133 MB
```

### AWS Billed Duration
THE Billed Duration is the total compute time that you are charged for for a particular Lambda execution. This can include compute across a variety of phases of execution (see image below.)

![Billed Duration Breakdown](./AWS-phases.png)

### AWS Lambda Start Time
This is the timestamp on the Cloudwatch `START` log line of an AWS Lambda invocation.  This starts after the AWS Lambda Initialization Phase, when the AWS Lambda Invocation Phase begins

```text
2022-06-13T15:06:50.561-07:00	START RequestId: a9fa9a-819a-19a9-faia-afu891asf Version: $LATEST
```

### AWS Lambda End Time
This is the timestamp on the Cloudwatch `END` log line of an AWS Lambda invocation.

```text
2022-06-13T15:06:51.041-07:00	END RequestId: a9fa9a-819a-19a9-faia-afu891asf
```

### AWS Lambda Init Duration
This is the Init Duration number from the Cloudwatch `REPORT` of an AWS Lambda invocation.  This is optionally shown, mostly if the AWS Lambda invocation was a cold-start.

```text
2022-06-13T15:06:51.041-07:00   REPORT RequestId: a9fa9a-819a-19a9-faia-afu891asf	Duration: 480.41 ms	Billed Duration: 481 ms	Memory Size: 1024 MB	Max Memory Used: 133 MB   Init Duration: 1099.82 ms
```

## Child Spans
We breakdown the execution of Lambda invocations into the following spans. If you have [Tracing Enabled](../integrations/enable-monitoring-features.md#enabling-traces) on your function this will include our [Node SDK](../integrations/data-sources-and-roles.md#serverless-node-sdk) you will see the following spans.  

### `aws.lambda`
This is the parent Span in every AWS Lambda Trace. It covers the following AWS Lambda lifecycle phases: Initialization and Invocation.

If you DO NOT have our SDK installed as an Internal AWS Lambda Extension via our AWS Lambda Layer, this Span’s `startTime` is based on the **AWS Lambda Start Time** and its `endTime` is based on the **AWS Lambda End Time**.  Optionally, if AWS Lambda Init Duration is available, this Span’s startTime is adjusted by subtracting the AWS Lambda Init Duration from the AWS Lambda Start Time.

If you DO have our SDK installed as an Internal AWS Lambda Extension via our AWS Lambda Layer, this Span’s `startTime` is based on the **AWS Lambda Start Time** and its `endTime` is based on the **AWS Lambda End Time**.  Optionally, if **AWS Lambda Init Duration** is available, this Span’s `startTime` is adjusted by subtracting the **AWS Lambda Init Duration** from the **AWS Lambda Start Time**.  The `startTime` of both `aws.lambda` and `aws.lambda.initialization` Spans should always be the same, since the former is the parent of the latter.

It’s important to note that there are cases where a bug in your code can cause AWS Lambda’s `initialization` phase to fail (e.g. a bug outside your function handler exists or module import fails).  This can result in an AWS Lambda Duration that exceeds the difference between the AWS Lambda Start Time and AWS Lambda End Time because AWS Lambda may retry the initialization phase upon failure.  If your AWS Lambda function already has a slow cold-start time, this will cause those retries to take longer, greatly increasing the AWS Lambda Duration.

 ### aws.lambda.initialization
This Span covers the entire Initialization Phase of the AWS Lambda execution (AKA the “Cold-Start” Phase).  This Span is only available if you have our SDK installed as an Internal AWS Lambda Extension via our AWS Lambda Layer, and the **AWS Lambda Init Duration** exists.

This Span’s `startTime` is based on the **AWS Lambda Start Time** minus the **AWS Lambda Init Duration**.  This Span’s `endTime` is calculated by our SDK, which shows more accurately when the Initialization Phase ended.  The `startTime` of both `aws.lambda` and `aws.lambda.initialization` Spans should always be the same, since the former is the parent of the latter.

### aws.lambda.invocation
This Span covers the entire Invocation Phase of the AWS Lambda execution.  This Span is only available if you have our SDK installed as an Internal AWS Lambda Extension via our AWS Lambda Layer.

This Span’s `startTime` is based on the **AWS Lambda Start Time**.  This Span’s endTime is calculated by our SDK, which shows more accurately when the Invocation Phase ended.

It’s important to note that the **AWS Lambda Duration** is not the same as the AWS Lambda Invocation Phase, due to possible post-processing that may happen in any AWS Lambda External Extensions installed.  Depending on how the External Extension is configured, this post-processing should happen after your AWS Lambda function handler code has been completed, so it should not affect your application performance.  Often, this post-processing can be greater than the duration of your handler code.

Therefore, this Span and the `aws.lambda.initialization` Span offers the greatest understanding of your application performance, and the latency your end-users may experience.  Looking at this information will offer greater clarity than looking at the AWS Lambda Duration.
