class SlsSpanAttributes:

    SLS_AWS_REQUEST_IDS = "sls.aws.request_ids"
    SLS_AWS_REQUEST_IDS_COUNT = "sls.aws.request_ids.count"

    SLS_HANDLER_RENAMED = "sls.handler.renamed"
    SLS_HANDLER_ACTUAL = "sls.handler.actual"
    SLS_HANDLER_MIDDLEWARE = "sls.handler.middleware"
    SLS_HANDLER_ENTRYPOINT = "sls.handler.entrypoint"

    SLS_ORIGINAL_PROPERTIES = "sls.original_properties"


class OverloadedSpanAttributes:

    HTTP_PATH = "http.path"
