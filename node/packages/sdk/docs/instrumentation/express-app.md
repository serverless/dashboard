# [`express`](https://expressjs.com/) app instrumentation

_Disable with `SLS_DISABLE_EXPRESS_MONITORING` environment variable_

If [`express`](https://expressjs.com/) framework (together with tools like [`serverless-http`](https://github.com/dougmoscrop/serverless-http)) is used to route incoming requests. Trace spans for it's middlewares are created

Tracing is turned on automatically, assuming that `express` is loaded normally via Node.js `require`. If it comes bundled then instrumentation needs to be turned on manually with following steps:

```javascript
import express from 'express';

const app = express();

serverlessSdk.instrumentation.expressApp.install(app);
```

Handling of express route is covered in context of main `express` span. Additionally middleware jobs are recorded as following spans:

- `express.middleware.<name>`, generic middleware (setup via `app.use`)
- `express.middlewa.route.<method>.<name>` - route specific middleware (setup via `app.get`, `app.post` etc.)
- `express.middleware.error.<name>` - error handling middleware

#### Tags introduced on _root_ span

| Name                          | Value                 |
| ----------------------------- | --------------------- |
| `aws.lambda.http_router.path` | Middleware route path |
