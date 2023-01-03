# Node.js [`console`](https://nodejs.org/api/console.html) instrumentation

_Disable with `SLS_DISABLE_NODE_CONSOLE_MONITORING` environment variable_

All `console.error` invocations are monitored and propagated as [captured errors](../sdk.md#captureerrorerror-options) to the Serverless Console
