<!--
title: Metrics
menuText: Metrics
description: Metric definitions
menuOrder: 6
-->

# Metrics 

Metrics about your [Trace](traces.md) are collected and stored in Serverless
Console. These metrics are stored individually on each trace as well as
aggregated for storage and alerting purposes. The [tags](tags.md) from your
trace are also included on these metrics for [filtering](../using/metrics.md).

We are expanding the list of metrics and currently support the following metrics
for ingestion.

**FAAS Compute Duration** - This metric is used for collecting details about the
total time it took for a given Trace which is used for calculating costs. 

**FAAS Memory Percent**  - This is the memory percentage used for a function
invocation.