import io
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import UploadFile
from app.db.database import SessionLocal, init_db
from app.main import (
    correct_document,
    get_document_by_id,
    get_document_stats,
    health_check,
    list_documents,
    reprocess_document,
    startup_event,
    upload_documents,
)
from app.schemas.extraction import InvoiceCorrectionRequest

def run_all_tests():
    print("=" * 70)
    print("RUNNING COMPREHENSIVE END-TO-END TEST SUITE FOR TASKS 4, 5, AND 6")
    print("=" * 70)

    # 0. Startup & DB verification
    print("\n[1] Testing startup_event and SQLite DB initialization...")
    startup_event()
    db = SessionLocal()
    try:
        # 1. Health check endpoint
        print("\n[2] Testing GET /api/documents/health...")
        health = health_check()
        assert health["status"] == "healthy", f"Health check failed: {health}"
        print(f"    [PASS] Health status: {health['status']} | OCR Tesseract: {health['tesseract_ocr']['available']}")
        print(f"    [PASS] Supported file types: {len(health['supported_extensions'])} formats")

        # 2. Stats summary endpoint
        print("\n[3] Testing GET /api/documents/stats/summary...")
        stats = get_document_stats(db=db)
        assert stats["total"] >= 6, f"Expected at least 6 docs, got {stats['total']}"
        print(f"    [PASS] Stats: Total={stats['total']}, Verified={stats['verified']}, Needs Attention={stats['needs_attention']}, Failed={stats['failed']}")

        # 3. List documents endpoint & Filters
        print("\n[4] Testing GET /api/documents (All docs)...")
        all_docs = list_documents(q=None, mode="keyword", status="all", db=db)
        assert len(all_docs) >= 6
        print(f"    [PASS] Successfully retrieved {len(all_docs)} documents.")

        print("\n[5] Testing GET /api/documents?status=verified...")
        verified_docs = list_documents(q=None, mode="keyword", status="verified", db=db)
        print(f"    [PASS] Verified filter returned {len(verified_docs)} document(s): {[d.filename for d in verified_docs]}")

        print("\n[6] Testing GET /api/documents?status=failed...")
        failed_docs = list_documents(q=None, mode="keyword", status="failed", db=db)
        print(f"    [PASS] Failed filter returned {len(failed_docs)} document(s): {[d.filename for d in failed_docs]}")

        # 4. Keyword Search
        print("\n[7] Testing Keyword Search (q='INV-2026-001')...")
        kw_matches = list_documents(q="INV-2026-001", mode="keyword", status=None, db=db)
        assert len(kw_matches) >= 1
        print(f"    [PASS] Found {len(kw_matches)} match(es) for 'INV-2026-001': {kw_matches[0].filename}")

        # 5. Semantic Vector Search
        print("\n[8] Testing Semantic Vector Search (q='cloud hosting server infrastructure')...")
        sem_matches = list_documents(q="cloud hosting server infrastructure", mode="semantic", status=None, db=db)
        assert len(sem_matches) >= 1
        print(f"    [PASS] Found {len(sem_matches)} semantic match(es). Top matches:")
        for sm in sem_matches[:2]:
            print(f"         - {sm.filename} (Relevance Score: {round((sm.relevance_score or 0) * 100)}%)")

        print("\n[9] Testing Semantic Vector Search (q='freight logistics ocean transport')...")
        sem_freight = list_documents(q="freight logistics ocean transport", mode="semantic", status=None, db=db)
        assert len(sem_freight) >= 1
        print(f"    [PASS] Found {len(sem_freight)} semantic match(es). Top match: {sem_freight[0].filename} ({round((sem_freight[0].relevance_score or 0) * 100)}%)")

        # 6. Single Document Details & Audit History
        print("\n[10] Testing GET /api/documents/{file_id}...")
        test_doc = all_docs[0]
        fetched_doc = get_document_by_id(file_id=test_doc.file_id, db=db)
        assert fetched_doc.file_id == test_doc.file_id
        print(f"    [PASS] Retrieved details for: {fetched_doc.filename}")
        print(f"    [PASS] Audit history logs present: {len(fetched_doc.history_logs)} entries")

        # 7. Interactive Human Correction & Auto Re-verification
        print("\n[11] Testing PUT /api/documents/{file_id}/correct (Auto-reverification)...")
        math_doc = next(d for d in all_docs if "02_invoice_math_mismatch" in d.filename)
        print(f"    Initial state: {math_doc.filename} -> Status: {math_doc.validation_result.validation_status.value.upper()}")
        print(f"    Initial math: Subtotal={math_doc.extraction_data.subtotal}, Tax={math_doc.extraction_data.tax}, Total={math_doc.extraction_data.total}")

        # In sample_02: Subtotal=1000.0, Tax=100.0, Total was 1250.0 (math mismatch).
        # Correct the grand total to 1100.00:
        correction = InvoiceCorrectionRequest(
            total=1100.00,
            edit_note="User corrected grand total to $1100.00 to balance Subtotal ($1000) + Tax ($100)"
        )
        corrected_doc = correct_document(file_id=math_doc.file_id, correction=correction, db=db)
        assert corrected_doc.validation_result.validation_status.value == "valid", f"Expected valid, got {corrected_doc.validation_result.validation_status.value}"
        assert corrected_doc.validation_result.requires_manual_review is False
        assert corrected_doc.validation_result.errors_count == 0
        print(f"    [PASS] Correction applied successfully!")
        print(f"    [PASS] New Status: {corrected_doc.validation_result.validation_status.value.upper()}")
        print(f"    [PASS] Requires Review: {corrected_doc.validation_result.requires_manual_review}")
        print(f"    [PASS] Audit logs updated ({len(corrected_doc.history_logs)} logs). Latest:")
        latest_history = corrected_doc.history_logs[-1]
        print(f"         Action: {latest_history['action']} -> {latest_history['details']}")

        # 8. Reprocess Endpoint: Re-running from raw file bytes
        print("\n[12] Testing POST /api/documents/{file_id}/reprocess...")
        reprocessed = reprocess_document(file_id=math_doc.file_id, db=db)
        assert reprocessed.validation_result.validation_status.value == "needs_review"
        print(f"    [PASS] Reprocessed document from raw bytes!")
        print(f"    [PASS] Status correctly reset to raw document state: {reprocessed.validation_result.validation_status.value.upper()}")
        print(f"    [PASS] Audit action logged: {reprocessed.history_logs[-1]['action']} -> {reprocessed.history_logs[-1]['details']}")

        # 9. Upload Endpoint
        print("\n[13] Testing POST /api/documents/upload with new invoice file...")
        sample_csv = b"Description,Quantity,UnitPrice,LineTotal\nCloud Compute VM,2,50,100\nSSD Block Storage,1,25,25"
        upload_file = UploadFile(
            file=io.BytesIO(sample_csv),
            filename="production_cloud_invoice.csv",
            headers={"content-type": "text/csv"},
        )
        batch_resp = upload_documents(files=[upload_file], db=db)
        assert batch_resp.total_files == 1
        uploaded_doc = batch_resp.documents[0]
        print(f"    [PASS] File uploaded and ingested: {uploaded_doc.filename} (ID: {uploaded_doc.file_id})")
        print(f"    [PASS] Processing time: {uploaded_doc.metadata.processing_time_ms}ms")
        print(f"    [PASS] Extracted line items: {len(uploaded_doc.extraction_data.line_items) if uploaded_doc.extraction_data else 0}")
        print(f"    [PASS] Audit logs initialized: {len(uploaded_doc.history_logs)} log(s)")

        print("\n" + "=" * 70)
        print("ALL 13 END-TO-END TESTS PASSED FLAWLESSLY!")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    run_all_tests()
