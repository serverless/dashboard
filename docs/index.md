<!--
title: Overview
menuText: Overview
description: 
menuOrder: 1
-->

# Serverless Console

Serveless Console is the next generation of control plane for Teams building as
Serverless architecture. We have a limited number of spots for teams that are
interested in testin our private preview. 

[Request access now.](https://www.serverless.com/console ) 

## Getting Started

To get started with Serverless Console use version 3.7.1 or later of the
Serverless Framework. 

**Upgrade or Install Serverless Framework**

```
npm install -g serverless
```

**Login from the CLI to Create your Org**

You'll be promoted to create a user, and orginization. You can read
more about this in our [User Guide](/using/). (If you have used
Serverless Dashboard in the past you can skip this)

```
serverless login
```

**Setup a local AWS Access Key**
Serverless Console leverages the providers concept from
Serverless Framework to make it easyo to target the aporpriate
Cloud Provider to deploy into. 

1. To get started with console fist [create an AWS access key](https://www.youtube.com/watch?v=KngM5bfpttA)
(AWS Console Access required).
1. Configure your Credentials locally.

```text
serverless config credentials \
  --provider aws \
  --key AKIAIOSFODNN7EXAMPLE \
  --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Get started a simple http api template.**
The following onboarding command will clone a repo
for a simple Node.js API and deploy it to your
AWS account. This app will be instrumented
automatically wtih our [Serverless Runtime](/concepts)
Open Telemetry collector. 

```text
serverless \
    --org=<your-org-name> \
    --name=console-node-http-api \
    --template=aws-node-http-api \
    --console
```

**That's it!**

After your app is deployed, hitting the endpoint from the previous command
will start producing [Traces](traces.md) in Console. For more details see 
our [concepts section](concepts.md) or learn about using [Serverles Console](/using/).
