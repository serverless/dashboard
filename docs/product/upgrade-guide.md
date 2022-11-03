<!--
title: Upgrade Guide
menuText: Upgrade Guide
description: Upgrading Serverless Console for November release
menuOrder: 1
-->
# Upgrade Guide

On **Tuesday, November 1st at 11 AM PDT**, we released a new version of
Serverless Console which breaks deployments with the Serverless Console
extension on Serverless Framework version 3.23.0 and earlier. There are a few
things you will need to do to upgrade to the latest Serverless Console.

## Action Items
- You MUST remove `console: true` from all `serverless.yml` files. Deployments
with `console: true` in the `serverless.yml` will fail if you are on version
older than 3.24.0 of the Serverless Framework.
- You SHOULD remove `org: <org>` from all `severless.yml` files, if you are not
also using Serverless Dashboard.
- You MUST visit https://console.serverless.com to reconnect your AWS account.
If you are using the Serverless Framework, you can use `serverless --console` to
reconnect your AWS account.
- You SHOULD upgrade to Serverless Framework 3.24.0 or higher with
`npm i serverless --global`.

## FAQ

### Why is this a breaking change?

We are changing how Serverless Console integrates with AWS to improve
performance and broaden the scope of observable resources. This means the new
version of Serverless Console no longer depends on the Serverless Framework to
add the Lambda extension via Layers to your lambda functions.

Watch the [60 second video overview of the new Serverless Console](https://www.loom.com/share/bfedf4f4644f4e85b1adc5f4d66f414e)
to learn more about the new features we are laucnhing.

### What will happen if I don’t complete the action items?

If you have `console: true` in your `serverless.yml`, then deployments will
fail. The deployment process depends on an API that are no longer be available.

### Will my old data be available?

Your data from your services will continue to be available in Serverless Console
until November 1st. Once we migrate to the new version, all old data will be
lost. Once you reconnect your AWS account after November 1st, all the metrics
data will be made available as soon as you reconnect your AWS account.

### What do I need to do to regain access to Serverless Console?

By completing the action items listed above, access to Serverless Console will
be restored. Deployment is no longer required to add instrumentation to your
services.

