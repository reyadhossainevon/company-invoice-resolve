import pytest
from app.config import BASE_DIR
from app.schemas.document import ExtractedContent
from app.services.extractor import InformationExtractor
from app.services.pipeline import DocumentPipeline

SAMPLE_DIR = BASE_DIR / "sample_data" / "files"


def test_zero_hallucination_empty_content():
    """Verifies that completely empty content returns all nulls with missing fields identified."""
    empty_content = ExtractedContent(pages=[], sheets={}, text_summary="")
    res = InformationExtractor.extract("empty.pdf", "application/pdf", empty_content)
    assert res.invoice_number is None
    assert res.invoice_date is None
    assert res.supplier_name is None
    assert res.total is None
    assert "invoice_number" in res.missing_fields
    assert "total" in res.missing_fields
    assert res.extraction_confidence <= 0.5


def test_digital_pdf_deterministic_extraction():
    pdf_path = SAMPLE_DIR / "01_valid_invoice_walton.pdf"
    content = pdf_path.read_bytes()
    resp = DocumentPipeline.process_single_file(pdf_path.name, content)
    ext = resp.extraction_data
    assert ext is not None
    assert ext.invoice_number == "INV-WALTON-2026-01"
    assert ext.invoice_date == "2026-03-10"
    assert "Walton Hi-Tech" in (ext.supplier_name or "")
    assert ext.subtotal == 50000.00
    assert ext.tax == 7500.00
    assert ext.total == 57500.00
    assert ext.currency == "BDT"
    assert len(ext.line_items) == 2


def test_multisheet_excel_extraction():
    excel_path = SAMPLE_DIR / "04_monthly_ledger_sheet.xlsx"
    content = excel_path.read_bytes()
    resp = DocumentPipeline.process_single_file(excel_path.name, content)
    ext = resp.extraction_data
    assert ext is not None
    assert ext.invoice_number == "PO-BEX-2026-4401"
    assert ext.invoice_date == "2026-03-15"
    assert "Beximco" in (ext.supplier_name or "")
    assert ext.subtotal == 80000.00
    assert ext.tax == 12000.00
    assert ext.total == 92000.00
    assert ext.currency == "BDT"
    assert len(ext.line_items) == 4


def test_csv_extraction_with_missing_fields():
    """Verifies that missing date and supplier in CSV are recorded in missing_fields."""
    csv_path = SAMPLE_DIR / "03_missing_info_aarong.csv"
    content = csv_path.read_bytes()
    resp = DocumentPipeline.process_single_file(csv_path.name, content)
    ext = resp.extraction_data
    assert ext is not None
    assert ext.total == 15000.00
    assert ext.supplier_name is None
    assert "supplier_name" in ext.missing_fields
    assert ext.currency == "BDT"
