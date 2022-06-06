<!--
title: Duration
menuText: Duration
description: Details about the durations shown in the Console UI 
menuOrder: 3
-->

# Duration
The term duration is used in a variety of scenario and charts
within Serverless Console. This helps provide a glossary of terms, and 
explains what is included, or excluded when looking at duration
values in Serverless Console charts and interfaces.

## Glossary 

**Duration** Unless otherwise noted Duration refers to the total execution time
of your function plus the duration of any execution time of any Lambda Extensions 
including the Serveless Runtime OTEL Extension.

**Billed Duration** Billed duration is the amount of compute duration used to 
calculate cost in Console. This metric is received from AWS after the transaction
is complete and should be the Duration rounded up to the closest 100ms.

**Extension(s) Duration** Extension durations are included in the overall duration, 
but are not included in the [Child Spans of the Trace](trace.md). Extension duration 
will always include the Serverless Runtime OTEL Extension duration and may also
include additional extension you are running. This may result in a different duration 
show in the Trace details, than the duration found on the charts and explorer. 

**OTEL Trace Duration** The Trace duration is caclulated based on the StartTime and 
EndTime recorded by our instrumentation during your function execution plus, the Cold Start
duration if one occurs. This appears as a timeline in the [Child Spans of the Trace](trace.md).

## Understanding Duration Across Console
Applying these definitions, you can expect the following behavior and details
are incldued across Console. 

**On the Metrics View**
The red number and dots represent the slowest 5% of transactions that occurred 
during the time frame selected. This does not include Cold Starts. 

The black number and line describe the average Duration for the selected timeframe. 
This does not include Cold Starts.

**On the Explorer** 
When the Trace is first received the value shown, is the Trace Duration of *your* function
and does not yet include Extension Duration. A few seconds after the Trace is received we receive
the full duration details and show the full duration with any Cold Starts duration. The max value progress bar is calculated based on the 5% slowest duration during the timeframe to help show relative performance of the trace. 

**On Trace Detail View**
The Duration shown in the header represents the execution time
of your function plus the duration of any execution time of any Lambda Extensions 
including the Serveless Runtime OTEL Extension.

The span chart is based on the start and end times collected from the 
Open Telemetry trace, plus the recorded Cold Start if one occurred. 
It does not include Lambda Extension Execution Times and is therefore not \directly related to Billed Duration.

**When Filtering**
Filtering is based on the Duration of your function, pluse the duration 
of any Lambda Extensions including the Serveless Runtime OTEL Extension.

**When Calculating Cost**
Cost is calculated based on Billed Duration. 

