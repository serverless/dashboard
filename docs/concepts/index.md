<!--
title: Concepts
menuText: Concepts
description: Overview of concepts used on serevrless console. 
menuOrder: 1
-->

# Concepts 
Serverless Console is built on a simple set of observability 
concepts that work across all types of apps - no matter how 
they are built or managed. We built Console on the three pillars
of observability - [logs](logs.md), [metrics](metrics) and [traces](traces.md).

## Open Telemetry
[Open Telemetry](http://opentelemtry.io) is a Cloud Native Compute
Foundation project that makes Distributed Tracing easy to setup
and vendor agnostic. We have adopted the best of the Open Telemetry's
[standards and semantics](tags.md) to build Serverless Console.

## Serverless Runtime
[Serverless Runtime](http://github.com/serverless/runtime) is our collection 
of [Open Telemetry](http://opentelemtry.io) collectors we use to automatically
instrument your application. We package Serverless runtime in Serverless
Framework, or get see [Serverless Runtime](http://github.com/serverless/runtime)
for installing your own collectors.

