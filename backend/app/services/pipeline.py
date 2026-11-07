import logging
import time
import traceback
import uuid
from typing import Optional
from app.core.exceptions import (
    CorruptedFileException,
    DocumentProcessingException,
    FileValidationException,
    PasswordProtectedException,
)
from app.core.file_validator import FileValidator
from app.schemas.document import (
    DocumentMetadata,
    DocumentResponse,
    DocumentStatus,
    ErrorDetails,
    ExtractedContent,
    ExtractionMethod,
    PageContent,
    SheetData,
)
from app.services.extractor import InformationExtractor
from app.services.ocr_processor import OCRProcessor
from app.services.pdf_processor import PDFProcessor
from app.services.spreadsheet_processor import SpreadsheetProcessor
from app.services.validator import DataValidationEngine

logger = logging.getLogger(__name__)


class DocumentPipeline:
    """
    Master pipeline orchestrating:
    - Task 1: Ingestion, Validation & Format-specific Document Processing
    - Task 2: AI Information Extraction (Zero-Hallucination Policy)
    - Task 3: Data Validation Engine (Math checks, Missing fields, Duplicate detection)
    """

    @classmethod
    def process_single_file(
        cls,
        filename: str,
        content: bytes,
        content_type: str = "",
        file_id: Optional[str] = None,
    ) -> DocumentResponse:
        """
        Executes end-to-end processing across Tasks 1, 2, and 3.
        Guaranteed to never raise an unhandled exception to prevent server crashing.
        """
        start_time = time.perf_counter()
        doc_id = file_id or str(uuid.uuid4())
        file_size = len(content) if content else 0

        try:
            # 1. Validation (extension, magic bytes, file size, empty check)
            ext, detected_mime = FileValidator.validate(filename, content, content_type)

            pages_output = []
            sheets_output = {}
            text_summary = ""
            extraction_method = ExtractionMethod.NONE
            extra_meta = {}
            sheet_names_list = []
            page_count = 0

            # 2. Dispatch to format-specific processors (Task 1)
            if ext == ".pdf":
                raw_pages, text_summary, meta, overall_method = PDFProcessor.process_pdf(content, filename)
                page_count = meta.get("page_count", len(raw_pages))
                extra_meta = meta
                extraction_method = ExtractionMethod(overall_method)

                pages_output = [
                    PageContent(
                        page_number=p["page_number"],
                        text=p["text"],
                        char_count=p["char_count"],
                        method=ExtractionMethod(p["method"]),
                        ocr_confidence=p.get("ocr_confidence"),
                        image_preprocessing=p.get("image_preprocessing"),
                    )
                    for p in raw_pages
                ]

            elif ext in {".jpg", ".jpeg", ".png", ".tiff", ".tif"}:
                raw_pages, text_summary, meta = OCRProcessor.process_image_file(content, filename)
                page_count = meta.get("page_count", len(raw_pages))
                extra_meta = meta
                extraction_method = ExtractionMethod.OCR

                pages_output = [
                    PageContent(
                        page_number=p["page_number"],
                        text=p["text"],
                        char_count=p["char_count"],
                        method=ExtractionMethod.OCR,
                        ocr_confidence=p.get("ocr_confidence"),
                        image_preprocessing=p.get("image_preprocessing"),
                    )
                    for p in raw_pages
                ]

            elif ext in {".xlsx", ".xls"}:
                raw_sheets, text_summary, meta = SpreadsheetProcessor.process_excel(content, filename)
                sheet_names_list = meta.get("sheet_names", [])
                extra_meta = meta
                extraction_method = ExtractionMethod.SPREADSHEET_PARSER

                sheets_output = {
                    s_name: SheetData(
                        sheet_name=s_data["sheet_name"],
                        columns=s_data["columns"],
                        row_count=s_data["row_count"],
                        column_count=s_data["column_count"],
                        records=s_data["records"],
                    )
                    for s_name, s_data in raw_sheets.items()
                }

            elif ext == ".csv":
                raw_sheets, text_summary, meta = SpreadsheetProcessor.process_csv(content, filename)
                sheet_names_list = meta.get("sheet_names", [])
                extra_meta = meta
                extraction_method = ExtractionMethod.SPREADSHEET_PARSER

                sheets_output = {
                    s_name: SheetData(
                        sheet_name=s_data["sheet_name"],
                        columns=s_data["columns"],
                        row_count=s_data["row_count"],
                        column_count=s_data["column_count"],
                        records=s_data["records"],
                    )
                    for s_name, s_data in raw_sheets.items()
                }

            extracted_content = ExtractedContent(
                pages=pages_output,
                sheets=sheets_output,
                text_summary=text_summary,
            )

            # 3. Task 2: AI Information Extraction (Zero-Hallucination Policy)
            extraction_data = InformationExtractor.extract(
                filename=filename,
                content_type=detected_mime,
                extracted_content=extracted_content,
            )

            # 4. Task 3: Data Validation Engine (Cross-verification & Duplicates)
            validation_result = DataValidationEngine.validate(
                doc_id=doc_id,
                filename=filename,
                extraction_data=extraction_data,
                raw_content=content,
            )

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return DocumentResponse(
                file_id=doc_id,
                filename=filename,
                file_type=detected_mime,
                file_size=file_size,
                status=DocumentStatus.PROCESSED,
                metadata=DocumentMetadata(
                    page_count=page_count,
                    sheet_names=sheet_names_list,
                    file_size_bytes=file_size,
                    processing_time_ms=elapsed_ms,
                    extraction_method=extraction_method,
                    content_type=detected_mime,
                    extra_details=extra_meta,
                ),
                extracted_content=extracted_content,
                extraction_data=extraction_data,
                validation_result=validation_result,
                error_details=None,
            )

        except (FileValidationException, CorruptedFileException, PasswordProtectedException) as expected_err:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.warning("Document processing failed expectedly for '%s': %s", filename, expected_err.message)

            return DocumentResponse(
                file_id=doc_id,
                filename=filename,
                file_type=content_type or "unknown",
                file_size=file_size,
                status=DocumentStatus.FAILED,
                metadata=DocumentMetadata(
                    page_count=0,
                    sheet_names=[],
                    file_size_bytes=file_size,
                    processing_time_ms=elapsed_ms,
                    extraction_method=ExtractionMethod.NONE,
                    content_type=content_type or "unknown",
                ),
                extracted_content=None,
                extraction_data=None,
                validation_result=None,
                error_details=ErrorDetails(
                    error_code=expected_err.error_code,
                    error_reason=expected_err.message,
                ),
            )

        except Exception as unexpected_err:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            tb = traceback.format_exc()
            logger.error("Unexpected error processing '%s': %s\n%s", filename, unexpected_err, tb)

            return DocumentResponse(
                file_id=doc_id,
                filename=filename,
                file_type=content_type or "unknown",
                file_size=file_size,
                status=DocumentStatus.FAILED,
                metadata=DocumentMetadata(
                    page_count=0,
                    sheet_names=[],
                    file_size_bytes=file_size,
                    processing_time_ms=elapsed_ms,
                    extraction_method=ExtractionMethod.NONE,
                    content_type=content_type or "unknown",
                ),
                extracted_content=None,
                extraction_data=None,
                validation_result=None,
                error_details=ErrorDetails(
                    error_code="INTERNAL_SERVER_ERROR",
                    error_reason=f"Processing failed: {str(unexpected_err)}",
                    stack_trace=tb,
                ),
            )
