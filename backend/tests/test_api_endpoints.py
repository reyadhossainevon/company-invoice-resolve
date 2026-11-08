import io
import pytest
from fastapi import UploadFile
from app.config import BASE_DIR
from app.db.database import SessionLocal

SAMPLE_DIR = BASE_DIR / "sample_data" / "files"
from app.main import (
    correct_document,
    get_document_by_id,
    get_document_stats,
    get_evaluation_metrics,
    health_check,
    list_documents,
    reprocess_document,
    upload_documents,
)
from app.schemas.extraction import InvoiceCorrectionRequest


def test_api_health_check():
    health = health_check()
    assert health["status"] == "healthy"
    assert "tesseract_ocr" in health
    assert "supported_extensions" in health


def test_api_upload_documents(db_session):
    csv_content = b"Description,Quantity,UnitPrice,LineTotal\nCloud Hosting,1,100,100\n"
    upload_file = UploadFile(
        file=io.BytesIO(csv_content),
        filename="test_api_upload.csv",
        headers={"content-type": "text/csv"},
    )
    res = upload_documents(files=[upload_file], db=db_session)
    assert res.total_files == 1
    assert res.successful_count == 1
    doc = res.documents[0]
    assert doc.filename == "test_api_upload.csv"
    assert len(doc.history_logs) >= 1


def test_api_list_and_search_documents(db_session):
    # Upload two distinct documents
    f1 = UploadFile(
        file=io.BytesIO(b"invoice_number,supplier_name,total\nINV-ALPHA-100,Acme Cloud Services,500\n"),
        filename="alpha_cloud.csv",
        headers={"content-type": "text/csv"},
    )
    f2 = UploadFile(
        file=io.BytesIO(b"invoice_number,supplier_name,total\nINV-BETA-200,Maritime Freight Logistics,900\n"),
        filename="beta_shipping.csv",
        headers={"content-type": "text/csv"},
    )
    upload_documents(files=[f1, f2], db=db_session)

    # 1. List all
    all_docs = list_documents(q=None, mode="keyword", status="all", db=db_session)
    assert len(all_docs) >= 2

    # 2. Keyword search
    kw_results = list_documents(q="ALPHA", mode="keyword", status=None, db=db_session)
    assert len(kw_results) >= 1
    assert any("alpha" in d.filename.lower() for d in kw_results)

    # 3. Semantic search
    sem_results = list_documents(q="ocean shipping cargo freight", mode="semantic", status=None, db=db_session)
    assert len(sem_results) >= 1
    assert "beta_shipping" in sem_results[0].filename


def test_api_interactive_correct_and_reprocess(db_session):
    # Upload document with math mismatch: subtotal 100, tax 10, total 150
    mismatch_csv = b"invoice_number,supplier_name,invoice_date,currency,subtotal,tax,total\nINV-M-01,Test Supplier,2026-01-01,USD,100.0,10.0,150.0\n"
    f = UploadFile(
        file=io.BytesIO(mismatch_csv),
        filename="math_mismatch_test.csv",
        headers={"content-type": "text/csv"},
    )
    up_res = upload_documents(files=[f], db=db_session)
    doc_id = up_res.documents[0].file_id

    # Verify initial status is needs_review
    initial = get_document_by_id(file_id=doc_id, db=db_session)
    assert initial.validation_result.validation_status.value == "needs_review"

    from app.schemas.extraction import LineItem
    # Apply manual correction fixing total to 110.0 and balancing line item
    correction = InvoiceCorrectionRequest(
        total=110.0,
        subtotal=100.0,
        tax=10.0,
        line_items=[
            LineItem(description="Consulting Service", quantity=1.0, unit_price=100.0, line_total=100.0)
        ],
        edit_note="Fixed total to 110 to balance subtotal + tax"
    )
    corrected = correct_document(file_id=doc_id, correction=correction, db=db_session)
    assert corrected.validation_result.validation_status.value == "valid"
    assert corrected.validation_result.requires_manual_review is False
    assert any("manually_corrected" in h["action"] for h in corrected.history_logs)

    # Reprocess from original file bytes
    reprocessed = reprocess_document(file_id=doc_id, db=db_session)
    assert reprocessed.validation_result.validation_status.value == "needs_review"
    assert any("reprocessed" in h["action"] for h in reprocessed.history_logs)


def test_api_stats_summary(db_session):
    stats = get_document_stats(db=db_session)
    assert "total" in stats
    assert "verified" in stats
    assert "needs_attention" in stats
    assert "failed" in stats


def test_api_evaluation_metrics():
    metrics = get_evaluation_metrics()
    assert "overall_extraction_accuracy_pct" in metrics
    assert "validation_detection_accuracy_pct" in metrics
    assert "avg_latency_ms" in metrics
    assert "test_cases" in metrics
    assert metrics["overall_extraction_accuracy_pct"] >= 90.0


def test_api_delete_individual_and_clear_all(db_session):
    from fastapi import HTTPException
    from app.main import delete_document_by_id, clear_all_documents
    from app.services.pipeline import DocumentPipeline
    from app.services.document_service import DocumentService

    # Upload sample to guarantee at least 1 document in test db
    pdf_path = SAMPLE_DIR / "01_valid_invoice_walton.pdf"
    content = pdf_path.read_bytes()
    doc_resp = DocumentPipeline.process_single_file(filename=pdf_path.name, content=content)
    DocumentService.save_document_response(db_session, doc_resp, raw_content=content)

    doc_id = doc_resp.file_id
    # Test single delete
    del_res = delete_document_by_id(file_id=doc_id, db=db_session)
    assert del_res["status"] == "success"

    # Verify document is gone
    with pytest.raises(HTTPException) as exc:
        get_document_by_id(file_id=doc_id, db=db_session)
    assert exc.value.status_code == 404

    # Test clear all
    clear_res = clear_all_documents(db=db_session)
    assert clear_res["status"] == "success"
    all_docs = DocumentService.list_documents(db_session)
    assert len(all_docs) == 0
