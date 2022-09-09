<!--
title: Enabling Console with Serverless Framework
menuText:  Enabling Console with Serverless Framework
description: Instrumenting Console using Serverless Framework
menuOrder: 6
-->

#  Enabling Console with Serverless Framework

Once you have added an [AWS Account Integration](index.md) you can 
can enable logs and traces from the Serverless Framework.

You'll need version v3.23 or later, to upgrade you framework run the 
following command.

```text
npm -g install serverless
serverless deploy 
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
      trace:
        disable: true
      
# Service name (required)
service: myservice

# Framework version 3.23 or higher
frameworkVersion: '3.23'
```

In addition to these properties the `ENVIRONMENT` is also based
on the stage you use during the deploy command. 

```text
serverless deploy --stage #included as environment
```

## Serverless Extension Version and Upgrading



