<!--
title: Trace Explorer
menuText: Trace Explorer
description: A guide to using our metric views and create your own.
menuOrder: 3
-->
# Traces
Serverless Console is built around using Traces to help you quickly 
navigate to a precise peice of code or system that may be causing
problems. 

To do this we provided a set of tools for analyzing events in your 
distributed systems we call a Trace. 

## Trace Explorer 
Similar to our [Metrics View](metrics.md) the Trace Explorer
provides you a starting point for discovering errors, or
slowness across your Orginization. Similar to metrics views
you can apply filters to narrow in on errors, slowness or
usage patterns across your orginization. 

Traces share the same set of filters from our [Metrics View](metrics.md)
but are not saved.

## Trace Details
Trace details provide the specifics about an event happening
in your system. The Trace has a set of Metrics we collect,
Tags, used for filtering, and Child Spans for all events
instrumented using our [Serverless Runtime](../concepts) collectors. 

### Tags and Metrics ###
Each Trace has some optional metrics (like CPU Duration and Memory) as
well as Tags we use to filter, and chart them. These details are exposed
in the Trace Detail view. 

### Child Spans ## 
We display Child Span events to a Trace in the style of a Gant Chart.
This chart provides you with context for when, and how long various
subsequent interactions took. 

For more details about Child Spans see our [concepts section](../concepts).