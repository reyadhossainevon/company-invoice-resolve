class DocumentProcessingException(Exception):
    """Custom exception raised when document processing fails."""

    def __init__(self, message: str, error_code: str = "PROCESSING_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class FileValidationException(DocumentProcessingException):
    """Raised when file validation (extension, mime type, size, magic bytes) fails."""

    def __init__(self, message: str, error_code: str = "VALIDATION_ERROR"):
        super().__init__(message, error_code=error_code)


class CorruptedFileException(DocumentProcessingException):
    """Raised when file bytes are corrupted or header cannot be decoded."""

    def __init__(self, message: str, error_code: str = "CORRUPTED_FILE"):
        super().__init__(message, error_code=error_code)


class PasswordProtectedException(DocumentProcessingException):
    """Raised when a PDF or document is encrypted with a password."""

    def __init__(self, message: str = "Document is password protected and cannot be read."):
        super().__init__(message, error_code="PASSWORD_PROTECTED")
