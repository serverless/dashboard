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

To get started with Serverless Console use version 3.5 or later of the
Serverless Framework. This will automatically configure a lambda extension,
authentication, and collection. To enable this you’ll need to do the following.

**Upgrade to Serverless Framework**

```bash
# install locally in a project
npm install serverless@3.5
# or update globally
npm install -g serverless@3.5
```

**Get started with our Express JS Example App.**
```bash
serverless \
    --org=<your-org-name> \
    --name=console-node-http-api \
    --template=aws-node-http-api
```

Login into console and nswer **no** when asked if you want to deploy now. 

```bash
➜  console-node-http-api serverless \
    --org=<your-org-name> \
    --name=console-node-http-api \
    --template=aws-node-http-api

Creating a new serverless project


✔ Project successfully created in console-node-http-api folder

Logging in the Serverless Dashboard via the browser
If your browser does not open automatically, please open this URL:
<URL>

✔ You are now logged in the Serverless Dashboard


✔ Your project is ready to be deployed to Serverless Dashboard (org: "my-org", app: "cconsole-node-http-api")

? Do you want to deploy now? No
```


**Enable console in your serverless.yaml file.**

```yaml
org: <your-org>
service: console-node-rest-api-app
console: true
dashboard: true 
frameworkVersion: '3'

functions:
  hello:
    handler: handler.hello
    events:
      - http:
          path: /
          method: get
```

**Setup your AWS Access Key**


**Deploy using Serverless Framework Deploy command in your new project.**


```bash
cd console-node-http-api 
serverless deploy
```
