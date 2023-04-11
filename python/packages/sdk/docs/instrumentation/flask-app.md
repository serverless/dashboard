# [`flask`](https://pypi.org/project/Flask/) app instrumentation

_Disable with `SLS_DISABLE_FLASK_MONITORING` environment variable_.

If [`flask`](https://pypi.org/project/Flask/) framework is used to route incoming requests, trace spans for it's middlewares are created.

Tracing is turned on automatically.

Handling of flask is covered in context of main `flask` span. Additionally following spans are available
- `flask.route.<method>.<name>` - route specific span (setup via `@app.route`)
- `flask.error.<name>` - handler for errors
