import os
import shutil
from pathlib import Path
from typing import Set

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Size & File Limits
MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS: Set[str] = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".tiff",
    ".tif",
    ".xlsx",
    ".xls",
    ".csv",
}

ALLOWED_MIME_TYPES: Set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
    "text/plain",
    "application/octet-stream",  # Fallback for some browsers, checked via magic bytes
}

# Tesseract OCR Configuration
def find_tesseract_cmd() -> str | None:
    """Auto-detect Tesseract binary on the host system."""
    env_tess = os.getenv("TESSERACT_CMD")
    if env_tess and os.path.exists(env_tess):
        return env_tess
    
    # Common Windows paths
    windows_candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    ]
    for candidate in windows_candidates:
        if os.path.exists(candidate):
            return candidate

    # Search in system PATH
    which_tess = shutil.which("tesseract")
    if which_tess:
        return which_tess

    return None

TESSERACT_CMD = find_tesseract_cmd()
