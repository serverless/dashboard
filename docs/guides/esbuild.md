<!--
title: Using with esbuild
menuText: Using with esbuild
description: Configure esbuild with Serverless Framework for us with Serverless Console
menuOrder: 1
-->

## Using with esbuild

For the most part Console will support and correctly instrument APIs that are
built with popular frameworks like express and koa, as well as with API Gateway
mapped routes. The one exception is when using a bundler such as esbuild or
webpack that bundles source code with dependencies.

If your service is using the popular `serverless-plugin-esbuild` plugin in your
Serverless Framework app it is very simple, just add the following to your
esbuild config in your `serverless.yaml` file,

```yaml
custom:
  esbuild:
    external:
      - express
      - serverless-http
```

Be sure to replace `express` with whichever API library you are using.

If you do not set up your bundler to exclude your API library, your API paths in
Console will potentially be unclear and instead be cast to `/{proxy}+`. Setting
up your externals in your bundler ensures that Console receives API Paths that
are distinct.
