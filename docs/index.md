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
latest version of Serverless Framework (v3.15.2+ required).
**Note:** Only Node.js is supported at this time. 

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
console: true
org: my-org
service: my-aws-node-project

frameworkVersion: '3'
```

**Note:** If you are using Serveless Dashboard features be sure to keep an
app property set. This will give you access to existing dashboard
features like Providers, Parameters and Secrets. 

**Invoke your function, and login to Serverless Console**
Once you have deployed your function, do the following to start using Serveless Console.

1. Login to [Serverless Console](https://console.serverless.com) 
1. Invoke your function, or hit you API Endpoint

It may take a second for the first data point to show up,
but will speed up considerably from there. Each time you invoke
one of your instrumented functions, we receive [Traces](./concepts/traces.md) in Console. 

For more details see our [concepts section](./concepts) or learn about using [Serverles Console](./using/).
