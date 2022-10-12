<!--
title: Duration
menuText: Duration
description: Details about the durations shown in the Console UI 
menuOrder: 8
-->

# Duration
The term duration is used in a variety of scenario and charts
within Serverless Console. This helps provide a glossary of terms, and 
explains what is included, or excluded when looking at duration
values in Serverless Console charts and interfaces.

## Initialization

## Invocation 


## Understanding Duration Across Console
Applying these definitions, you can expect the following behavior and details
are included across Console. 

**On the Metrics View**
The red number and dots represent the slowest 5% of transactions that occurred 
during the time frame selected. This does not include Cold Starts. 

The black number and line describe the average Duration for the selected time frame. 
This does not include Cold Starts.

**On the Explorer** 
When the Trace is first received the value shown, is the Trace Duration of *your* function
and does not yet include Extension Duration. A few seconds after the Trace is received we receive
the full duration details and show the full duration with any Cold Starts duration. The max value progress bar is calculated based on the 5% slowest duration during the time frame to help show relative performance of the Trace. 

**On Trace Detail View**
The Duration shown in the header represents the execution time
of your function plus the duration of any execution time of any Lambda Extensions 
including the Serverless Console Extension.

The span chart is based on the start and end times collected from the 
Open Telemetry Trace, plus the recorded Cold Start if one occurred. 
It does not include Lambda Extension Execution Times and is therefore not \directly related to Billed Duration.

**When Filtering**
Filtering is based on the Duration of your function, pluse the duration 
of any Lambda Extensions including the Serverless Runtime OTEL Extension.

**When Calculating Cost**
Cost is calculated based on Billed Duration. 

## Optimizing Initialization in AWS Lambda
Initialization includes the following:

* Initializing all External AWS Lambda Extensions configured
on the function (there is a limit of 10 Extensions per function).

* Initializing the AWS Lambda Runtime (e.g, Node.js, Python).

* Initializing the AWS Lambda Function code.

You will want to optimize Initialization performance as best you can. Poor Initialization performance will directly affect the experience of your users and customers. Additionally, it's important to note that AWS charges you for Initialization time. Unfortunately, no tooling can offer a breakdown of what happens within the Initialization phase of AWS Lambda. Generally, adding multiple Extensions, large code file sizes, and using a slower runtime (e.g., Java) are the biggest culprits when it comes to slow Initialization.

Once initialized, each instance of your function can process thousands of requests without performing another Initialization. However, AWS Lambda function instance containers will shutdown within 5-15 minutes of inactivity. After that, the next event will be a Cold-Start, causing Initialization to run again.

## Configuring Timeouts in AWS Lambda
It's important to note that your function's timeout setting limits the duration of the entire Invocation phase. For example, if you set the function timeout as 360 seconds, the function and all extensions need to complete within 360 seconds.


## Extensions and the Invocation Phase

The Invocation phase is comprised mostly of your handler (i.e. your business logic), and you want to optimize that as best you can because its performance (combined with Initialization performance) will have the biggest impact on the experience for your users and customers.

* Running External Extensions in parallel with the function. These also continue running after the function has completed, enabling Serverless Console to capture diagnostic information and ingest metrics, Traces and logs.

* Running the wrapper logic for Internal Extensions.

* Running the handler for your AWS Lambda.




