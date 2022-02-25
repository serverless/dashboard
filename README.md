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

To get started with Serverless Console use version 3.1 or later of the
Serverless Framework. This will automatically configure a lambda extension,
authentication, and collection. To enable this you’ll need to do the following.

**Upgrade to Serverless frame 3.1 pre-release.**

```bash
# install locally in a project
npm i serverless@pre-3.1
# or update globally
npm -g i serverless@pre-3.1
```

**Enable console in your serverless.yaml file.**

```yaml
org: serverless-inc
frameworkVersion: '3.1'
console: true
```

**Redeploy with Serverless Framework.**

```bash
serverless deploy
```
