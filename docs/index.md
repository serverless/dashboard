<!--
title: Getting Started
menuText: Getting Started
description: 
menuOrder: 1
-->

# Getting Started
Welcome to Serveless Console. 

The next generation monitoring tool for Teams 
building with Serverless architectures. The easiest way 
to get started with Serverless Console is using the 
latest version of Serverless Framework (v3.7.5+ required).

```text
npm install -g serverless
```

You can configure an existing project with 
Serverless by adding `--console` flag the serverless command. 

```text
serverless --console
```

This will set the following in your Serverless project. 

```yaml
dashboard: true
console: true
org: ahevenor
service: aws-node-project

frameworkVersion: '3'
```

**Note:** If you are using Serveless Dashboard features be sure to keep
the dashboard property set to true. This will give you access to existing
dashboard features like Providers. 

**Setting up a new project from a template**
To start with a new example project, just run the following where
you want to create your project.

```text
serverless --console
```

This will begin an interactive onboarding experience, which creates
your first Serverless Framwork project.

```text
Creating a new serverless project

? What do you want to make? (Use arrow keys)
❯ AWS - Node.js - Starter
  AWS - Node.js - HTTP API
  AWS - Node.js - Scheduled Task
  AWS - Node.js - SQS Worker
  AWS - Node.js - Express API
  AWS - Node.js - Express API with DynamoDB
  Other
```

After your app is deployed, hitting the endpoint from the previous command
will start producing [Traces](./concepts/traces.md) in Console. For more details see 
our [concepts section](./concepts) or learn about using [Serverles Console](./using/).
