class ScanError(Exception):
    """Base for adapter failures."""


class RateLimitedError(ScanError):
    pass


class TimeoutError_(ScanError):
    pass


class ConnectionError_(ScanError):
    pass


class ParseError(ScanError):
    pass
