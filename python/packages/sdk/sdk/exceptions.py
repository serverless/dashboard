class SdkException(Exception):
    """Base class for all serverless exceptions."""

    pass


class InvalidName(SdkException, ValueError):
    pass


class InvalidType(SdkException, TypeError):
    pass


class InvalidTraceSpanTagValue(InvalidType):
    pass


class InvalidTraceSpanTagName(InvalidName):
    pass


class InvalidTraceSpanName(InvalidName):
    pass
