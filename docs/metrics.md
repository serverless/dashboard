<!--
title: Metrics
menuText: Metrics
description: Metric definitions
menuOrder: 5
-->

## Metrics & Metric Definitions
Metrics are included on a Trace as tags that we collect and 
store without the Trace Identifier (but with most other tags).  Metrics 
are used to drive charts and alerts within Console and including tags 
on them allows for filtering of those metrics for both. That said, we 
impose limits on the cardinality of tags collected with metrics 

We currently only support the following metrics for ingestion.

**Trace (Required)** - This is the core metric we build upon for 
collecting attributes about a Trace . It’s value is always 1, 
but it collects valuable information about errors, status codes, and 
compute platforms for filtering across various use cases.

**FAAS Duration (Optional)** - This metric is used for collecting 
details about the total time it took for a given Trace which is 
used for calculating costs. 

**FAAS Memory Percent (Optional)**  - This is the memory percentage 
used for a function invocation.