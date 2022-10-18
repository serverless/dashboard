<!--
title: Upgrade Guide
menuText: Upgrade Guide
description: Upgrading Serverless Console for October release
menuOrder: 7
-->
# Upgrade Guide

On **Tuesday, October 25th at 10AM PDT**, we will be releasing a new version
of Serverless Console which will break existing deployments with the Serverless
Console extension. There are a few things you will need to do before and after
the release of the new Serverless Console.

## Action items before October 25th at 10AM PDT:
- You MUST remove `console: true` from all `serverless.yml` files.
- If you don’t also use Serverless Dashboard, then you SHOULD remove
`app: <app>` from all `severless.yml` files.

## Action items after October 25th at 10AM PDT:
- You MUST upgrade Serverless Framework to version 3.24.0 or greater with
`npm i serverless --global`.
- You MUST run `serverless --console`, or visit console.serverless.com, to
reconnect your AWS account after October 25th at 10AM.

## FAQ

### Why is this a breaking change?

The new version of Serverless Console no longer depends on the Serverless
Framework to add the Lambda extension via Layers to your lambda functions.

### What will happen if I don’t complete the action items before October 25th?

If you have `console: true`, in your `serverless.yml`, then deployments will
fail after Tuesday, October 25th at 10AM PDT. The deployment process depends
on an API that will no longer be available.

### What will happen if I complete these the action items before October 25th?

Once you remove `console: true` from your `serverless.yml`, then the service
will no longer be instrumented for Serverless Console and therefore you will not
see the metrics, traces, and logs in Serverless Console. Once you complete the
steps after October 25th, you'll regain access to metrics, traces, and logs.

### Will my old data be available?

Your data from your services will continue to be available in Serverless Console
until October 25th. Once we migrate to the new version, all old data will be
lost. Once you reconnect your AWS account after October 25th, all the metrics
data will be made available as soon as you reconnect your AWS account.

### What do I need to do to regain access to Serverless Console?

By completing the “Action Items after October 25th at 10AM PDT”, access to
Serverless Console will be restored. Unlike the current version of Serverless
Console, you will no longer need to redeploy your service to enable monitoring.
Instead, you'll be able to manage instrumentation from the web via Serverless
Console.

