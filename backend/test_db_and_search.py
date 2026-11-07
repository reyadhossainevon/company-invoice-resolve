from app.main import startup_event
from app.db.database import SessionLocal
from app.services.document_service import DocumentService
from app.services.search_service import SearchEngine
from app.schemas.extraction import InvoiceCorrectionRequest, LineItem

startup_event()

db = SessionLocal()
try:
    docs = DocumentService.list_documents(db)
    print(f"Total documents loaded in DB: {len(docs)}")
    for d in docs:
        v_status = d.validation_result.validation_status.value if d.validation_result else d.status.value
        print(f" - {d.filename} | Status: {v_status} | Needs Review: {d.validation_result.requires_manual_review if d.validation_result else 'N/A'}")

    # Test semantic search
    queries = ["cloud hosting server", "freight shipping delivery", "corrupted damaged"]
    for q in queries:
        matches = SearchEngine.search(db, query=q, mode="semantic")
        print(f"\nSemantic search matches for '{q}': {len(matches)}")
        for doc, score in matches[:3]:
            print(f"   -> {doc.filename} (Score: {score})")

    # Test manual correction: find sample_02_math_mismatch.pdf
    math_doc = next((d for d in docs if "math_mismatch" in d.filename), None)
    if math_doc:
        print(f"\nBefore correction: {math_doc.filename} status: {math_doc.validation_result.validation_status.value}")
        # Fix the total: subtotal was 1200, tax was 120 -> correct total should be 1320.00 (was 1500.00)
        correction = InvoiceCorrectionRequest(
            total=1320.00,
            edit_note="Corrected grand total to match Subtotal ($1,200) + Tax ($120)"
        )
        updated = DocumentService.correct_document(db, math_doc.file_id, correction)
        print(f"After correction: {updated.filename} status: {updated.validation_result.validation_status.value}")
        print(f"Errors count: {updated.validation_result.errors_count}, Needs review: {updated.validation_result.requires_manual_review}")
        print(f"History logs count: {len(updated.history_logs)}")
        for h in updated.history_logs:
            print(f"   [History] {h['action']} -> {h['details']}")
finally:
    db.close()
