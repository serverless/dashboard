class SdkException(Exception):
    """Base class for all Serverless SDK exceptions."""
    pass


class InvalidValue(SdkException, ValueError):
    pass


class InvalidType(SdkException, TypeError):
    pass


class InvalidTraceSpanTagValue(InvalidType):
    pass


class InvalidTraceSpanTagName(InvalidValue):
    pass


class InvalidTraceSpanName(InvalidValue):
    pass


class DuplicateTraceSpanName(InvalidValue):
    pass


class FutureSpanStartTime(InvalidValue):
    pass


class PastSpanEndTime(InvalidValue):
    pass


class ClosureOnClosedSpan(SdkException):
    pass

