<!--
title: Concepts
menuText: Concepts
description: Overview of concepts used on serevrless console. 
menuOrder: 1
-->

# Concepts 
Serverless Console is built on a simple set of observability concepts that work
across all types of apps - no matter how they are built or managed. We built
Console on the three pillars of observability - [logs](logs.md), [metrics](metrics)
and [traces](traces.md).

## Open Telemetry
[Open Telemetry](https://opentelemtry.io) is a Cloud Native Compute Foundation
project that makes Distributed Tracing easy to setup and vendor agnostic. We
have adopted the best of the Open Telemetry [standards and semantics](tags.md)
to build out a Tracing experience that's organized and intuitive. 

## Serverless Runtime
To make instrumentaiton automatic we're launching a new Open Source effort
called [Serverless Runtime](https://github.com/serverless/runtime).

Serverless runtime is our collection of [Open Telemetry](https://opentelemtry.io) 
collectors we use to instrument a variety of computing platforms.  

The fastest way to get started with Serverless Runtime is to use the version
packaged in Serverless Framwork by setting the console property in your
`serverless.yaml` file. 

```yaml
org: empty
console: true
service: a
frameworkVersion: '3'
```
