<!--
title: Overview
menuText: Overview
description: 
menuOrder: 1
-->

# Serverless Console

Serveless Console is the next generation of control plan for Teams building as
Serverless as Possible. We have a limited number of spots for teams that are
interested in monitoring Serverless architectures. 

[Request access.](https://www.serverless.com/console ) 

## Getting Started

To get started with Serverless Console use version 3.7 or later of the
Serverless Framework. This will automatically configure a lambda extension,
authentication, and collection. To enable this you’ll need to do the following.

**Upgrade or Install Serverless Framework**

```
npm install -g serverless@3.7
```

**Get started with a simple http app.**

```text
serverless \
    --org=<your-org-name> \
    --name=console-node-http-api \
    --template=aws-node-http-api \
    --console
```

Signup or login to Serverless Console. 

**Change directory to your new project and deploy your app.**
```text
cd console-http-api
serverless deploy
```

**That's it!**

After your app is deployed, hitting the endpoint from the previous command
will start producing [Traces](traces.md) in Console. For more details see 
our [concepts section](concepts.md)


