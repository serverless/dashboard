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

## Getting Started

To get started with Serverless Console use version 3.7.1 or later of the
Serverless Framework.

**Upgrade or Install Serverless Framework**

```
npm install -g serverless
```

You can configure an existing project with
Serverless by adding `--console` flag the serverless command.

```text
serverless --console
```

Or get started with on of our templates

```text
serverless \
  --org=<your-org-name> \
  --name=console-http-api \
  --template=aws-node-express-api \
  --console
```

**That's it!**

After your app is deployed, hitting the endpoint from the previous command
will start producing [Traces](traces.md) in Console. For more details see
our [concepts section](./concepts) or learn about using [Serverles Console](./using/).
