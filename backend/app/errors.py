class DomainError(Exception):
    def __init__(self, status, code, message, details=None):
        self.status, self.code, self.message, self.details = status, code, message, details or {}
        super().__init__(message)


def require(condition, status, code, message, details=None):
    if not condition:
        raise DomainError(status, code, message, details)
