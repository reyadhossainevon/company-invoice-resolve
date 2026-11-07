from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.extraction import (
    InvoiceExtractionData,
    DocumentValidationResult,
    LineItem,
    ValidationRuleResult,
    ValidationStatus,
    ValidationRuleStatus,
)


class DocumentStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class ExtractionMethod(str, Enum):
    DIGITAL_PDF = "digital_pdf"
    OCR = "ocr"
    HYBRID_PDF = "hybrid_pdf"
    SPREADSHEET_PARSER = "spreadsheet_parser"
    NONE = "none"


class PageContent(BaseModel):
    page_number: int
    text: str
    char_count: int
    method: ExtractionMethod
    ocr_confidence: Optional[float] = None
    image_preprocessing: Optional[Dict[str, Any]] = None


class SheetData(BaseModel):
    sheet_name: str
    columns: List[str]
    row_count: int
    column_count: int
    records: List[Dict[str, Any]]  # Clean JSON records


class DocumentMetadata(BaseModel):
    page_count: int = 0
    sheet_names: List[str] = Field(default_factory=list)
    file_size_bytes: int
    processing_time_ms: float
    extraction_method: ExtractionMethod
    content_type: str
    extra_details: Dict[str, Any] = Field(default_factory=dict)


class ExtractedContent(BaseModel):
    pages: List[PageContent] = Field(default_factory=list)
    sheets: Dict[str, SheetData] = Field(default_factory=dict)
    text_summary: str = ""


class ErrorDetails(BaseModel):
    error_code: str
    error_reason: str
    stack_trace: Optional[str] = None


class DocumentResponse(BaseModel):
    file_id: str
    filename: str
    file_type: str
    file_size: int
    status: DocumentStatus
    metadata: DocumentMetadata
    extracted_content: Optional[ExtractedContent] = None
    extraction_data: Optional[InvoiceExtractionData] = None  # Task 2
    validation_result: Optional[DocumentValidationResult] = None  # Task 3
    error_details: Optional[ErrorDetails] = None
    history_logs: List[Dict[str, Any]] = Field(default_factory=list)
    relevance_score: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BatchUploadResponse(BaseModel):
    total_files: int
    successful_count: int
    failed_count: int
    processing_time_total_ms: float
    documents: List[DocumentResponse]
