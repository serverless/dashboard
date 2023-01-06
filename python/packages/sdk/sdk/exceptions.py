class SdkException(Exception):
    """Base class for all serverless exceptions."""
    pass


class InvalidName(SdkException, ValueError):
    pass


class InvalidType(SdkException, TypeError):
    pass

