<!--
title: Using Serveless Console
menuText: Using Serveless Console
description: A guide to using Serverless Console UI
menuOrder: 1
-->

# Overview
Serverless Console provides an easy to use User Interface for monitoring your
Serverless architectures. We automatically recongize patterns by observing
[Traces](traces.md) sent by our [Serverless Runtime instrumentation](../concepts/index.md).


To start using the Console to monitor your apps, you'll need to signup, and
create your own organization. 


**Setting up a new project from a template**
To start with a new example project, just run the following where you want to
create your project.

```text
serverless --console
```

This will begin an interactive onboarding experience, which creates your first
Serverless Framwork project.

```text
Creating a new serverless project

? What do you want to make? (Use arrow keys)
  AWS - Node.js - Starter
  AWS - Node.js - HTTP API
  AWS - Node.js - Scheduled Task
  AWS - Node.js - SQS Worker
❯ AWS - Node.js - Express API
  AWS - Node.js - Express API with DynamoDB
  Other
```
