<!--
title: Using with esbuild
menuText: Using with esbuild
description: Configure esbuild with Serverless Framework for us with Serverless Console
menuOrder: 5
-->

# Using With esbuild

## Using With ESM 

If your codebase uses `ESM` style imports/exports, currently in order for your app to work with Serverless Console, you must ensure that your handlers are exported in `cjs` style. For example if you have your business logic,

```typescript
// src/myapp/handler.ts
export const handler = (event: any) => {
    console.log('event ', event)
}
```

You would then need to either change that code to,

```typescript
// src/myapp/handler.ts
const handler = (event: any) => {
    console.log('event ', event)
}

module.exports = { handler }
```

Or re-export your handler for use from your `serverless.yaml` file,

```typescript
// src/index.ts

import { handler } from './myapp/handler'

module.exports = { handler }
```

All that matters is that the handler that is specified in your function in `serverless.yaml` is exported using CommonJS. This ensures that `serverless-esbuild` builds a bundle that the Serverless Console Extension will be able to instrument.

## API Usage

For the most part Console will support and correctly instrument APIs that are
built with popular frameworks like express and koa, as well as with API Gateway
mapped routes. The one exception is when using a bundler such as esbuild or
webpack that bundles source code with dependencies.

If your service is using the popular `serverless-esbuild` plugin in your
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
