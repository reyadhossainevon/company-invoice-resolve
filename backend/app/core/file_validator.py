import mimetypes
from pathlib import Path
from typing import Tuple
from app.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES
from app.core.exceptions import CorruptedFileException, FileValidationException


class FileValidator:
    """Validates uploaded files for size, extension, MIME type, and magic bytes."""

    MAGIC_SIGNATURES = {
        ".pdf": [b"%PDF-"],
        ".png": [b"\x89PNG\r\n\x1a\n"],
        ".jpg": [b"\xff\xd8\xff"],
        ".jpeg": [b"\xff\xd8\xff"],
        ".tiff": [b"II*\x00", b"MM\x00*"],
        ".tif": [b"II*\x00", b"MM\x00*"],
        ".xlsx": [b"PK\x03\x04"],
        ".xls": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    }

    @classmethod
    def validate(cls, filename: str, content: bytes, content_type: str = "") -> Tuple[str, str]:
        """
        Validates the file.
        Returns (normalized_ext, detected_mime_type)
        Raises FileValidationException or CorruptedFileException.
        """
        # 1. Check empty file
        if not content or len(content) == 0:
            raise CorruptedFileException("File is empty (0 bytes).", error_code="EMPTY_FILE")

        # 2. Check maximum size
        if len(content) > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise FileValidationException(
                f"File size exceeds maximum allowed limit of {max_mb:.0f} MB.",
                error_code="FILE_TOO_LARGE",
            )

        # 3. Check extension
        ext = Path(filename).suffix.lower()
        if not ext:
            raise FileValidationException("Missing file extension.", error_code="INVALID_EXTENSION")

        if ext not in ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS))
            raise FileValidationException(
                f"Unsupported file type '{ext}'. Allowed types: {allowed_list}",
                error_code="UNSUPPORTED_TYPE",
            )

        # 4. Magic bytes verification for binary formats
        if ext in cls.MAGIC_SIGNATURES:
            signatures = cls.MAGIC_SIGNATURES[ext]
            is_valid_magic = any(content.startswith(sig) for sig in signatures)
            if not is_valid_magic:
                # PDF might have some whitespace before %PDF- in rare edge cases, check first 1024 bytes
                if ext == ".pdf" and b"%PDF-" in content[:1024]:
                    is_valid_magic = True

            if not is_valid_magic:
                raise CorruptedFileException(
                    f"Corrupted or invalid file header for '{ext}'. File signature mismatch.",
                    error_code="CORRUPTED_HEADER",
                )

        # 5. Check CSV validity
        if ext == ".csv":
            try:
                # Test if text can be decoded with common text encodings
                decoded = None
                for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
                    try:
                        decoded = content[:4096].decode(enc)
                        break
                    except UnicodeDecodeError:
                        continue

                if decoded is None:
                    raise CorruptedFileException("Unable to decode CSV text file.", error_code="CORRUPTED_CSV")

                # Basic heuristic: ensure it's not a binary file mistakenly named .csv
                null_bytes = content[:1024].count(b"\x00")
                if null_bytes > 5:
                    raise CorruptedFileException("Binary data detected in CSV file.", error_code="CORRUPTED_CSV")

            except Exception as e:
                if isinstance(e, CorruptedFileException):
                    raise
                raise CorruptedFileException(f"Invalid CSV structure: {str(e)}", error_code="CORRUPTED_CSV")

        # Determine best MIME type
        guessed_mime, _ = mimetypes.guess_type(filename)
        mime = guessed_mime or content_type or "application/octet-stream"

        return ext, mime
