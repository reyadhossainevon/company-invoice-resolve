import os
from pathlib import Path
import sys
import time
from typing import Dict, List, Optional

# Ensure backend root is on sys.path
BASE_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BASE_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_BACKEND_DIR))

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import ALLOWED_EXTENSIONS, BASE_DIR, MAX_FILE_SIZE_BYTES, TESSERACT_CMD
from app.db.database import SessionLocal, get_db, init_db
from app.db.models import (
    DocumentRecord,
    ExtractedInvoiceRecord,
    ProcessingHistoryRecord,
    ValidationResultRecord,
)
from app.schemas.document import (
    BatchUploadResponse,
    DocumentMetadata,
    DocumentResponse,
    DocumentStatus,
    ErrorDetails,
    ExtractionMethod,
)
from app.schemas.extraction import InvoiceCorrectionRequest
from app.services.document_service import DocumentService
from app.services.ocr_processor import OCRProcessor
from app.services.pipeline import DocumentPipeline
from app.services.validator import InvoiceRegistry

app = FastAPI(
    title="AI Document Intelligence Processing Service",
    description="Multi-format document ingestion pipeline with intelligent PDF processing, OpenCV OCR, spreadsheet parsing, DB persistence, and hybrid search.",
    version="2.0.0",
)

# CORS setup for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_DIR = BASE_DIR / "sample_data" / "files"


@app.on_event("startup")
def startup_event():
    """Initializes SQLite database and pre-seeds sample documents if DB is empty."""
    init_db()
    db = SessionLocal()
    try:
        count = db.query(DocumentRecord).count()
        if count == 0 and SAMPLE_DIR.exists():
            # Automatically populate sample documents on fresh start
            InvoiceRegistry().clear()
            for f in sorted(SAMPLE_DIR.iterdir()):
                if f.is_file():
                    content = f.read_bytes()
                    doc_response = DocumentPipeline.process_single_file(
                        filename=f.name,
                        content=content,
                    )
                    DocumentService.save_document_response(
                        db=db,
                        doc_resp=doc_response,
                        raw_content=content,
                        action_note=f"Initial seed processing of sample document '{f.name}'.",
                    )
    finally:
        db.close()


@app.get("/api/documents/health")
def health_check():
    """Health check endpoint providing status of pipeline dependencies."""
    tesseract_installed = OCRProcessor.is_tesseract_available()
    return {
        "status": "healthy",
        "service": "AI-Powered Document Intelligence Engine",
        "tesseract_ocr": {
            "available": tesseract_installed,
            "configured_path": TESSERACT_CMD or "Auto-detected / Not configured",
        },
        "supported_extensions": sorted(list(ALLOWED_EXTENSIONS)),
        "max_file_size_mb": MAX_FILE_SIZE_BYTES / (1024 * 1024),
    }


@app.post("/api/documents/upload", response_model=BatchUploadResponse)
def upload_documents(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Accepts batch document uploads (.pdf, .jpg, .png, .tiff, .xlsx, .xls, .csv).
    Executes format-specific processing, saves to SQLite database, and returns standardized responses.
    """
    batch_start = time.perf_counter()
    results: List[DocumentResponse] = []

    for file in files:
        filename = file.filename or "unknown_file"
        content_type = file.content_type or ""
        try:
            # Safely read bytes synchronously from file.file
            if hasattr(file, "file") and hasattr(file.file, "read"):
                content = file.file.read()
            elif hasattr(file, "read"):
                content = file.read()
            else:
                content = b""
            doc_response = DocumentPipeline.process_single_file(
                filename=filename,
                content=content,
                content_type=content_type,
            )
            # Persist to database
            DocumentService.save_document_response(
                db=db,
                doc_resp=doc_response,
                raw_content=content,
                action_note=f"Uploaded and processed '{filename}'.",
            )
            # Re-fetch from DB to get populated history logs
            saved_doc = DocumentService.get_document(db, doc_response.file_id)
            results.append(saved_doc or doc_response)
        except Exception as e:
            import uuid

            err_doc = DocumentResponse(
                file_id=str(uuid.uuid4()),
                filename=filename,
                file_type=content_type or "unknown",
                file_size=0,
                status=DocumentStatus.FAILED,
                metadata=DocumentMetadata(
                    page_count=0,
                    sheet_names=[],
                    file_size_bytes=0,
                    processing_time_ms=0.0,
                    extraction_method=ExtractionMethod.NONE,
                    content_type=content_type or "unknown",
                ),
                extracted_content=None,
                error_details=ErrorDetails(
                    error_code="STREAM_READ_ERROR",
                    error_reason=f"Failed to read uploaded file: {str(e)}",
                ),
            )
            DocumentService.save_document_response(
                db=db,
                doc_resp=err_doc,
                action_note=f"Upload failed: {str(e)}",
            )
            results.append(err_doc)

    batch_elapsed_ms = round((time.perf_counter() - batch_start) * 1000, 2)
    successful = sum(1 for r in results if r.status == DocumentStatus.PROCESSED)
    failed = len(results) - successful

    return BatchUploadResponse(
        total_files=len(results),
        successful_count=successful,
        failed_count=failed,
        processing_time_total_ms=batch_elapsed_ms,
        documents=results,
    )


@app.get("/api/documents", response_model=List[DocumentResponse])
def list_documents(
    q: Optional[str] = Query(None, description="Search query string"),
    mode: str = Query("hybrid", description="Search mode: 'hybrid', 'keyword', or 'semantic'"),
    status: Optional[str] = Query(None, description="Filter: 'all', 'verified', 'needs_review', 'failed'"),
    db: Session = Depends(get_db),
):
    """
    Returns documents matching hybrid, keyword, or semantic query, with optional status filter.
    Includes TF-IDF cosine similarity relevance scores.
    """
    return DocumentService.list_documents(db, query=q, mode=mode, status=status)


@app.delete("/api/documents")
def clear_all_documents(db: Session = Depends(get_db)):
    """Clears all stored documents, history, and resets duplicate registry."""
    db.query(ProcessingHistoryRecord).delete()
    db.query(ValidationResultRecord).delete()
    db.query(ExtractedInvoiceRecord).delete()
    db.query(DocumentRecord).delete()
    db.commit()
    InvoiceRegistry().clear()
    return {"status": "success", "message": "All documents cleared successfully."}


@app.get("/api/documents/stats/summary")
def get_document_stats(db: Session = Depends(get_db)):
    """Returns top-level metric card statistics."""
    all_docs = DocumentService.list_documents(db)
    total = len(all_docs)
    verified = sum(
        1 for d in all_docs
        if d.status == DocumentStatus.PROCESSED
        and d.validation_result
        and d.validation_result.validation_status.value == "valid"
    )
    needs_attention = sum(
        1 for d in all_docs
        if d.status == DocumentStatus.PROCESSED
        and d.validation_result
        and d.validation_result.requires_manual_review
    )
    failed = sum(1 for d in all_docs if d.status == DocumentStatus.FAILED)

    return {
        "total": total,
        "verified": verified,
        "needs_attention": needs_attention,
        "failed": failed,
    }


@app.get("/api/documents/{file_id}", response_model=DocumentResponse)
def get_document_by_id(file_id: str, db: Session = Depends(get_db)):
    """Returns full details, extracted invoice data, validation results, and audit history."""
    doc = DocumentService.get_document(db, file_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.delete("/api/documents/{file_id}")
def delete_document_by_id(file_id: str, db: Session = Depends(get_db)):
    """Deletes a single document, its extraction data, validation results, and audit history."""
    deleted = DocumentService.delete_document(db, file_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success", "message": f"Document '{file_id}' deleted successfully."}


@app.put("/api/documents/{file_id}/correct", response_model=DocumentResponse)
def correct_document(
    file_id: str,
    correction: InvoiceCorrectionRequest,
    db: Session = Depends(get_db),
):
    """
    Allows interactive human correction of invoice fields.
    Automatically re-runs the Data Validation Engine so that if math or missing fields are fixed,
    the document status updates to 'verified'. Records an audit log in processing history.
    """
    updated_doc = DocumentService.correct_document(db, file_id, correction)
    if not updated_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return updated_doc


@app.post("/api/documents/{file_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(file_id: str, db: Session = Depends(get_db)):
    """
    Re-runs the document pipeline on the stored raw document bytes.
    Records a 'reprocessed' entry in audit history.
    """
    reprocessed = DocumentService.reprocess_document(db, file_id)
    if not reprocessed:
        raise HTTPException(status_code=404, detail="Document not found or raw bytes missing")
    return reprocessed


@app.get("/api/documents/samples")
def list_sample_files():
    """Returns a list of pre-generated sample documents available for one-click testing."""
    if not SAMPLE_DIR.exists():
        return {"samples": []}
    files = []
    for f in SAMPLE_DIR.iterdir():
        if f.is_file():
            files.append({
                "name": f.name,
                "size_bytes": f.stat().st_size,
                "extension": f.suffix.lower()
            })
    return {"samples": files}


@app.get("/api/documents/samples/{filename}")
def download_sample_file(filename: str):
    """Downloads an individual sample file."""
    target = SAMPLE_DIR / filename
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Sample file not found")
    return FileResponse(path=target, filename=filename)


# Cached pre-processed demo results to respond in < 50ms without OCR/memory spike
_CACHED_DEMO_RESULTS: Optional[List[DocumentResponse]] = None


@app.post("/api/documents/samples/run", response_model=BatchUploadResponse)
@app.get("/api/documents/samples/run", response_model=BatchUploadResponse)
@app.post("/api/demo", response_model=BatchUploadResponse)
@app.get("/api/demo", response_model=BatchUploadResponse)
def run_samples_test(db: Session = Depends(get_db)):
    """Resets database and returns the 5 pre-generated Bangladeshi BDT sample files with sub-100ms response."""
    global _CACHED_DEMO_RESULTS

    # Clean existing database records for fresh demo state
    db.query(ProcessingHistoryRecord).delete()
    db.query(ValidationResultRecord).delete()
    db.query(ExtractedInvoiceRecord).delete()
    db.query(DocumentRecord).delete()
    db.commit()

    # Clear duplicate registry for fresh test runs
    InvoiceRegistry().clear()

    batch_start = time.perf_counter()
    results: List[DocumentResponse] = []

    # If cached in memory, re-insert directly into DB in < 20ms
    if _CACHED_DEMO_RESULTS and len(_CACHED_DEMO_RESULTS) == 5:
        for cached_doc in _CACHED_DEMO_RESULTS:
            DocumentService.save_document_response(
                db=db,
                doc_resp=cached_doc,
                raw_content=b"DEMO_PRESEEDED_CONTENT",
                action_note=f"Instant seed for '{cached_doc.filename}'.",
            )
            saved = DocumentService.get_document(db, cached_doc.file_id)
            results.append(saved or cached_doc)
    else:
        demo_filenames = [
            "01_valid_invoice_walton.pdf",
            "02_wrong_math_daraz.pdf",
            "03_missing_info_aarong.csv",
            "04_monthly_ledger_sheet.xlsx",
            "05_damaged_file.pdf",
        ]

        for fname in demo_filenames:
            target_file = SAMPLE_DIR / fname
            if target_file.exists() and target_file.is_file():
                content = target_file.read_bytes()
                doc_response = DocumentPipeline.process_single_file(
                    filename=target_file.name,
                    content=content,
                )
                DocumentService.save_document_response(
                    db=db,
                    doc_resp=doc_response,
                    raw_content=content,
                    action_note=f"Demo run for '{target_file.name}'.",
                )
                saved_doc = DocumentService.get_document(db, doc_response.file_id)
                results.append(saved_doc or doc_response)

        # Cache results for subsequent instantaneous loads
        _CACHED_DEMO_RESULTS = results

    batch_elapsed_ms = round((time.perf_counter() - batch_start) * 1000, 2)
    successful = sum(1 for r in results if r.status == DocumentStatus.PROCESSED)
    failed = len(results) - successful

    return BatchUploadResponse(
        total_files=len(results),
        successful_count=successful,
        failed_count=failed,
        processing_time_total_ms=batch_elapsed_ms,
        documents=results,
    )


METRICS_JSON_PATH = BASE_DIR / "sample_data" / "evaluation_metrics.json"


@app.get("/api/evaluation/metrics")
def get_evaluation_metrics():
    """Returns measured benchmark and accuracy evaluation metrics from Task 7."""
    import json
    if METRICS_JSON_PATH.exists():
        try:
            return json.loads(METRICS_JSON_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    from evaluate_system import run_evaluation
    return run_evaluation()

