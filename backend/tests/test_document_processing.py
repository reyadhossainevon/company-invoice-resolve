import io
import pytest
from pathlib import Path
from app.config import BASE_DIR
from app.core.file_validator import FileValidator
from app.core.exceptions import CorruptedFileException, FileValidationException
from app.services.pdf_processor import PDFProcessor
from app.services.spreadsheet_processor import SpreadsheetProcessor
from app.services.ocr_processor import OCRProcessor
from app.services.pipeline import DocumentPipeline
from app.schemas.document import DocumentStatus

SAMPLE_DIR = BASE_DIR / "sample_data" / "files"


def test_file_validator_valid_pdf():
    pdf_path = SAMPLE_DIR / "01_valid_invoice_walton.pdf"
    content = pdf_path.read_bytes()
    ext, mime = FileValidator.validate(pdf_path.name, content, "application/pdf")
    assert ext == ".pdf"
    assert "pdf" in mime.lower()


def test_file_validator_corrupted_header():
    corrupted_bytes = b"NOT_A_VALID_PDF_HEADER_12345"
    with pytest.raises(CorruptedFileException) as exc:
        FileValidator.validate("fake.pdf", corrupted_bytes, "application/pdf")
    assert "File signature mismatch" in str(exc.value)


def test_file_validator_empty_file():
    empty_bytes = b""
    with pytest.raises(CorruptedFileException) as exc:
        FileValidator.validate("empty.pdf", empty_bytes, "application/pdf")
    assert exc.value.error_code == "EMPTY_FILE"


def test_file_validator_unsupported_format():
    with pytest.raises(FileValidationException) as exc:
        FileValidator.validate("script.sh", b"#!/bin/bash", "text/plain")
    assert exc.value.error_code == "UNSUPPORTED_TYPE"


def test_digital_pdf_processing():
    pdf_path = SAMPLE_DIR / "01_valid_invoice_walton.pdf"
    content = pdf_path.read_bytes()
    pages, text, meta, method = PDFProcessor.process_pdf(content, pdf_path.name)
    assert len(pages) == 1
    assert pages[0]["method"] == "digital_pdf"
    assert "Walton Hi-Tech" in pages[0]["text"]
    assert "INV-WALTON-2026-01" in text


def test_multi_sheet_excel_processing():
    excel_path = SAMPLE_DIR / "04_monthly_ledger_sheet.xlsx"
    content = excel_path.read_bytes()
    sheets, summary, meta = SpreadsheetProcessor.process_excel(content, excel_path.name)
    assert len(sheets) == 3
    assert "Invoice_Header" in sheets
    assert "Line_Items" in sheets
    assert "Monthly_Summary" in sheets
    assert sheets["Line_Items"]["row_count"] >= 4


def test_csv_processing():
    csv_path = SAMPLE_DIR / "03_missing_info_aarong.csv"
    content = csv_path.read_bytes()
    sheets, summary, meta = SpreadsheetProcessor.process_csv(content, csv_path.name)
    assert "CSV_Data" in sheets
    assert sheets["CSV_Data"]["row_count"] == 2
    assert "Aarong" in summary


def test_image_preprocessing_pipeline():
    image_path = SAMPLE_DIR / "06_scanned_receipt_ocr.png"
    content = image_path.read_bytes()
    pages, summary, meta = OCRProcessor.process_image_file(content, image_path.name)
    assert len(pages) == 1
    page = pages[0]
    assert page["image_preprocessing"] is not None
    assert page["image_preprocessing"].get("grayscale_applied") is True
    assert page["image_preprocessing"].get("adaptive_threshold_applied") is True


def test_pipeline_corrupted_file_isolation():
    """Verifies that corrupted files fail gracefully with structured error details."""
    corrupted_path = SAMPLE_DIR / "05_damaged_file.pdf"
    content = corrupted_path.read_bytes()
    resp = DocumentPipeline.process_single_file(corrupted_path.name, content)
    assert resp.status == DocumentStatus.FAILED
    assert resp.error_details is not None
    assert "Corrupted or invalid file header" in resp.error_details.error_reason
