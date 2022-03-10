# ⚡ runtime

Serverless runtime is our collection of [Open Telemetry](http://opentelemtry.io)
collectors we use to instrument a variety of computing platforms.

## Serverless Framwork Integration

The fastest way to get started with Serverless Runtime is
to use the version packaged in Serverless Framwork by setting the
console property in your `serverless.yaml' file.

```yaml
org: empty
console: true
service: a
frameworkVersion: '3'
```

## Lambda Extension

You can also add our extension to your Lambda function by doing
the following. Soon you'll be able to.

1. Get and manage console deployment tokens
1. Adding the token and your org details to your Lambda Layer
