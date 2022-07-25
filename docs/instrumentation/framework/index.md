<!--
title: Serverless Framework
menuText: Serverless Framework
description: Instrumenting Console using Serverless Framework
menuOrder: 6
-->

# Serverless Framework
Serverless Framework offers the simplest way to send data to 
Serverless Console. [See our get start guide](../../index.md) 
to start sending data using Serverless Framework.

## Logging into Serverless Console
In order to deploy your Serverless Framework project to
Serverless Console you'll need to login to Serveless Console
using the command.

```
serverless login --console
```

## Console Configuration
You can set the following properties in your `serverless.yaml` file
for various features within Serverless Console.  


```yaml

# Organization name (required)
org: myorg

# Console flag (can be set to true, or the following options can be include)
console: 
    monitoring:
      logs:
        disable: true
      request:
        disable: true
      response:
        disable: true

# Service name (required)
service: myservice

# Framework version 3.7.1 or higher
frameworkVersion: '3.7.1'
```

In addition to these properties the `ENVIRONMENT` is also based
on the stage you use during the deploy command. 

```text
serverless deploy --stage #included as environment
```

## Serverless Extension Version and Upgrading
Serverless Framework ultimately acts as packaging for the [Serverless
Console Extension](../aws/index.md). The version of the extension
can be seen on the [Trace Details view](../../product/traces.md).
To upgrade the Serverless Extension you simple need to upgrade
the Serverless Framework and re-deploy. 

```text
npm -g install serverless
serverless deploy 
```

