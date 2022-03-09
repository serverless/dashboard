<!--
title: Overview
menuText: Overview
description: 
menuOrder: 1
-->

# Serverless Console

Serveless Console is the next generation of control plane for Teams building as
Serverless architecture. Get started today. 

## Getting Started

The easiset way get started with Serverless Console is using the latest version
of Serverless Framwork (v3.7.2+ required) and run the following command on an
existing framework project.

**Upgrade or Install Serverless Framework**

```text
npm install -g serverless
```

You can configure an existing project with 
Serverless by adding `--console` flag the serverless command. 


```text
serverless --console
```

Or get started with one of our templates

```text
##Express JS API
serverless \
    --org=<your-org-name> \
    --name=console-http-api \
    --template=aws-node-express-api \
    --console
```

**That's it!**

After your app is deployed, hitting the endpoint from the previous command
will start producing [Traces](./concepts/traces.md) in Console. For more details see 
our [concepts section](./concepts) or learn about using [Serverles Console](./using/).
