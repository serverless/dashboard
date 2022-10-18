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
- You MUST remove `console: true` from all `serverless.yml` files. Deployments
after October 25th at 10AM will fail if `console: true` is present in the
`serverless.yml`. You can continue to deploy with `console: true` until then.
You can also continue to use Serverless Console without change until then.

- If you don’t also use Serverless Dashboard, then you SHOULD remove
`org: <org>` from all `severless.yml` files.
- Join the [Console community channel in Slack](https://serverless-contrib.slack.com/archives/C037D989FB5)
for up to date changes. We are doing our best to release at this time, but if
there are changes you’ll be able to get the latest in Slack.

## Action items after October 25th at 10AM PDT:
- You MUST upgrade Serverless Framework to version 3.24.0 or greater with
`npm i serverless --global`.
- You MUST run `serverless --console`, or visit console.serverless.com, to
reconnect your AWS account after October 25th at 10AM.

## FAQ

### Why is this a breaking change?

The new version of Serverless Console no longer depends on the Serverless
Framework to add the Lambda extension via Layers to your lambda functions.

## Can I keep using Serverless Console?

If you deploy your `serverless.yml` with `console: true` removed, you will no
longer be able to monitor it in Serverless Console. Deployments with
`console: true` will fail after October 25th. To keep using Serverless Console
do not deploy with `console: true` prior to October 25th. Then follow the steps
for "Action items after October 25th at 10AM PDT" to update to the latest
version of Serverless Framework and Serverless Console.

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

