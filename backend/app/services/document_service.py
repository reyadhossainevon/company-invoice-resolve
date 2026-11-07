import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.config import BASE_DIR
from app.db.database import Base, SessionLocal, engine
from app.db.models import (
    DocumentRecord,
    ExtractedInvoiceRecord,
    ProcessingHistoryRecord,
    ValidationResultRecord,
)
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
from app.schemas.extraction import (
    DocumentValidationResult,
    InvoiceCorrectionRequest,
    InvoiceExtractionData,
    LineItem,
    ValidationRuleResult,
    ValidationRuleStatus,
    ValidationStatus,
)
from app.services.pipeline import DocumentPipeline
from app.services.search_service import SearchEngine
from app.services.validator import DataValidationEngine

logger = logging.getLogger(__name__)

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DIR = BASE_DIR / "sample_data" / "files"


class DocumentService:
    @staticmethod
    def init_db():
        """Creates tables if they don't exist."""
        Base.metadata.create_all(bind=engine)

    @classmethod
    def save_document_response(
        cls,
        db: Session,
        doc_resp: DocumentResponse,
        raw_content: Optional[bytes] = None,
        action_note: str = "Pipeline processing completed",
    ) -> DocumentRecord:
        """
        Persists a DocumentResponse into SQLite tables.
        Optionally saves raw content bytes to disk for reprocessing.
        """
        raw_path = None
        if raw_content:
            raw_path = str(UPLOAD_DIR / f"{doc_resp.file_id}_{doc_resp.filename}")
            try:
                Path(raw_path).write_bytes(raw_content)
            except Exception as e:
                logger.warning("Could not persist raw upload bytes: %s", e)
                raw_path = None

        record = db.query(DocumentRecord).filter(DocumentRecord.id == doc_resp.file_id).first()
        if not record:
            record = DocumentRecord(id=doc_resp.file_id)
            db.add(record)

        record.filename = doc_resp.filename
        record.file_type = doc_resp.file_type
        record.file_size = doc_resp.file_size
        record.status = doc_resp.status.value
        if raw_path:
            record.raw_file_path = raw_path

        if doc_resp.metadata:
            record.page_count = doc_resp.metadata.page_count
            record.sheet_names_json = json.dumps(doc_resp.metadata.sheet_names or [])
            record.processing_time_ms = doc_resp.metadata.processing_time_ms
            record.extraction_method = doc_resp.metadata.extraction_method.value

        if doc_resp.error_details:
            record.error_code = doc_resp.error_details.error_code
            record.error_reason = doc_resp.error_details.error_reason
        else:
            record.error_code = None
            record.error_reason = None

        # 1. Extracted Invoice
        ext_data = doc_resp.extraction_data
        inv_record = record.extracted_invoice
        if ext_data:
            if not inv_record:
                inv_record = ExtractedInvoiceRecord(document_id=record.id)
                db.add(inv_record)

            inv_record.invoice_number = ext_data.invoice_number
            inv_record.invoice_date = ext_data.invoice_date
            inv_record.supplier_name = ext_data.supplier_name
            inv_record.customer_name = ext_data.customer_name
            inv_record.currency = ext_data.currency or "USD"
            inv_record.subtotal = ext_data.subtotal
            inv_record.tax = ext_data.tax
            inv_record.total = ext_data.total
            inv_record.line_items_json = json.dumps([li.model_dump() for li in ext_data.line_items])
            inv_record.extraction_confidence = ext_data.extraction_confidence
            inv_record.extraction_engine = ext_data.extraction_engine
            inv_record.uncertain_fields_json = json.dumps(ext_data.uncertain_fields or [])
            inv_record.missing_fields_json = json.dumps(ext_data.missing_fields or [])

            if doc_resp.extracted_content:
                inv_record.raw_text_summary = doc_resp.extracted_content.text_summary
                inv_record.pages_json = json.dumps([p.model_dump() for p in doc_resp.extracted_content.pages])
                sheets_dict = {
                    k: v.model_dump() for k, v in doc_resp.extracted_content.sheets.items()
                }
                inv_record.sheets_json = json.dumps(sheets_dict)

        # 2. Validation Result
        val_res = doc_resp.validation_result
        val_record = record.validation_result
        if val_res:
            if not val_record:
                val_record = ValidationResultRecord(document_id=record.id)
                db.add(val_record)

            val_record.validation_status = val_res.validation_status.value
            val_record.requires_manual_review = val_res.requires_manual_review
            val_record.confidence_score = val_res.confidence_score
            val_record.rule_results_json = json.dumps([r.model_dump() for r in val_res.rule_results])
            val_record.duplicate_info_json = json.dumps(val_res.duplicate_info) if val_res.duplicate_info else None
            val_record.errors_count = val_res.errors_count
            val_record.warnings_count = val_res.warnings_count
            val_record.passed_count = val_res.passed_count

        # 3. Processing History Entry
        if "reprocess" in action_note.lower():
            action_name = "reprocessed"
        elif doc_resp.status == DocumentStatus.PROCESSED:
            action_name = "processed"
        else:
            action_name = "failed"
        history = ProcessingHistoryRecord(
            document_id=record.id,
            action=action_name,
            details=action_note,
            timestamp=datetime.utcnow(),
        )
        db.add(history)

        db.commit()
        db.refresh(record)
        return record

    @classmethod
    def record_to_response(
        cls,
        rec: DocumentRecord,
        relevance_score: Optional[float] = None,
    ) -> DocumentResponse:
        """Converts an ORM record into a DocumentResponse."""
        # Reconstruct metadata
        extraction_method = ExtractionMethod.NONE
        try:
            extraction_method = ExtractionMethod(rec.extraction_method)
        except Exception:
            pass

        metadata = DocumentMetadata(
            page_count=rec.page_count or 0,
            sheet_names=rec.sheet_names,
            file_size_bytes=rec.file_size or 0,
            processing_time_ms=rec.processing_time_ms or 0.0,
            extraction_method=extraction_method,
            content_type=rec.file_type or "application/octet-stream",
        )

        # Extracted content
        extracted_content = None
        inv_record = rec.extracted_invoice
        if inv_record:
            pages: List[PageContent] = []
            try:
                pages_data = json.loads(inv_record.pages_json or "[]")
                for p in pages_data:
                    pages.append(PageContent(**p))
            except Exception:
                pass

            sheets: Dict[str, SheetData] = {}
            try:
                sheets_data = json.loads(inv_record.sheets_json or "{}")
                for k, v in sheets_data.items():
                    sheets[k] = SheetData(**v)
            except Exception:
                pass

            extracted_content = ExtractedContent(
                pages=pages,
                sheets=sheets,
                text_summary=inv_record.raw_text_summary or "",
            )

        # Extraction Data
        extraction_data = None
        if inv_record:
            line_items = [LineItem(**item) for item in inv_record.line_items]
            extraction_data = InvoiceExtractionData(
                invoice_number=inv_record.invoice_number,
                invoice_date=inv_record.invoice_date,
                supplier_name=inv_record.supplier_name,
                customer_name=inv_record.customer_name,
                currency=inv_record.currency or "USD",
                subtotal=inv_record.subtotal,
                tax=inv_record.tax,
                total=inv_record.total,
                line_items=line_items,
                extraction_confidence=inv_record.extraction_confidence or 0.0,
                extraction_engine=inv_record.extraction_engine or "deterministic",
                uncertain_fields=inv_record.uncertain_fields,
                missing_fields=inv_record.missing_fields,
            )

        # Validation Result
        validation_result = None
        val_record = rec.validation_result
        if val_record:
            rules = []
            for r in val_record.rule_results:
                rules.append(ValidationRuleResult(**r))

            val_status = ValidationStatus.VALID
            try:
                val_status = ValidationStatus(val_record.validation_status)
            except Exception:
                pass

            validation_result = DocumentValidationResult(
                validation_status=val_status,
                requires_manual_review=val_record.requires_manual_review,
                confidence_score=val_record.confidence_score,
                rule_results=rules,
                errors_count=val_record.errors_count,
                warnings_count=val_record.warnings_count,
                passed_count=val_record.passed_count,
                duplicate_info=val_record.duplicate_info,
            )

        # Error details
        error_details = None
        if rec.error_code or rec.error_reason:
            error_details = ErrorDetails(
                error_code=rec.error_code or "UNKNOWN_ERROR",
                error_reason=rec.error_reason or "An unexpected error occurred.",
            )

        # History logs
        history_logs = []
        for h in rec.history_logs:
            history_logs.append({
                "id": h.id,
                "action": h.action,
                "details": h.details,
                "timestamp": h.timestamp.isoformat() if h.timestamp else datetime.utcnow().isoformat(),
            })

        status_enum = DocumentStatus.PROCESSED if rec.status == "processed" else DocumentStatus.FAILED

        return DocumentResponse(
            file_id=rec.id,
            filename=rec.filename,
            file_type=rec.file_type,
            file_size=rec.file_size,
            status=status_enum,
            metadata=metadata,
            extracted_content=extracted_content,
            extraction_data=extraction_data,
            validation_result=validation_result,
            error_details=error_details,
            history_logs=history_logs,
            relevance_score=relevance_score,
            created_at=rec.created_at.isoformat() if rec.created_at else None,
            updated_at=rec.updated_at.isoformat() if rec.updated_at else None,
        )

    @classmethod
    def get_document(cls, db: Session, doc_id: str) -> Optional[DocumentResponse]:
        rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
        if not rec:
            return None
        return cls.record_to_response(rec)

    @classmethod
    def list_documents(
        cls,
        db: Session,
        query: Optional[str] = None,
        mode: str = "keyword",
        status: Optional[str] = None,
    ) -> List[DocumentResponse]:
        matches = SearchEngine.search(db, query=query, mode=mode, status_filter=status)
        return [cls.record_to_response(rec, score) for rec, score in matches]

    @classmethod
    def correct_document(
        cls,
        db: Session,
        doc_id: str,
        correction: InvoiceCorrectionRequest,
    ) -> Optional[DocumentResponse]:
        rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
        if not rec:
            return None

        inv_rec = rec.extracted_invoice
        if not inv_rec:
            inv_rec = ExtractedInvoiceRecord(document_id=rec.id)
            db.add(inv_rec)

        changes: List[str] = []

        if correction.invoice_number is not None:
            changes.append(f"Invoice #: {correction.invoice_number}")
            inv_rec.invoice_number = correction.invoice_number
        if correction.invoice_date is not None:
            changes.append(f"Date: {correction.invoice_date}")
            inv_rec.invoice_date = correction.invoice_date
        if correction.supplier_name is not None:
            changes.append(f"Supplier: {correction.supplier_name}")
            inv_rec.supplier_name = correction.supplier_name
        if correction.customer_name is not None:
            changes.append(f"Customer: {correction.customer_name}")
            inv_rec.customer_name = correction.customer_name
        if correction.currency is not None:
            changes.append(f"Currency: {correction.currency}")
            inv_rec.currency = correction.currency
        if correction.subtotal is not None:
            changes.append(f"Subtotal: {correction.subtotal}")
            inv_rec.subtotal = correction.subtotal
        if correction.tax is not None:
            changes.append(f"Tax: {correction.tax}")
            inv_rec.tax = correction.tax
        if correction.total is not None:
            changes.append(f"Total: {correction.total}")
            inv_rec.total = correction.total
        if correction.line_items is not None:
            changes.append(f"{len(correction.line_items)} line items updated")
            inv_rec.line_items_json = json.dumps([li.model_dump() for li in correction.line_items])

        # Recalculate missing fields list
        missing = []
        if not inv_rec.invoice_number:
            missing.append("invoice_number")
        if not inv_rec.invoice_date:
            missing.append("invoice_date")
        if not inv_rec.supplier_name:
            missing.append("supplier_name")
        if not inv_rec.currency:
            missing.append("currency")
        if inv_rec.total is None:
            missing.append("total")
        inv_rec.missing_fields_json = json.dumps(missing)

        # Build current ExtractionData for re-validation
        curr_items = [LineItem(**item) for item in inv_rec.line_items]
        curr_extraction = InvoiceExtractionData(
            invoice_number=inv_rec.invoice_number,
            invoice_date=inv_rec.invoice_date,
            supplier_name=inv_rec.supplier_name,
            customer_name=inv_rec.customer_name,
            currency=inv_rec.currency or "USD",
            subtotal=inv_rec.subtotal,
            tax=inv_rec.tax,
            total=inv_rec.total,
            line_items=curr_items,
            extraction_confidence=1.0,  # Human verified
            extraction_engine="human_corrected",
            uncertain_fields=[],
            missing_fields=missing,
        )

        # Run Validation Engine on the corrected values
        val_res = DataValidationEngine.validate(
            doc_id=rec.id,
            filename=rec.filename,
            extraction_data=curr_extraction,
        )

        # Update Validation Result Record
        val_rec = rec.validation_result
        if not val_rec:
            val_rec = ValidationResultRecord(document_id=rec.id)
            db.add(val_rec)

        val_rec.validation_status = val_res.validation_status.value
        val_rec.requires_manual_review = val_res.requires_manual_review
        val_rec.confidence_score = val_res.confidence_score
        val_rec.rule_results_json = json.dumps([r.model_dump() for r in val_res.rule_results])
        val_rec.duplicate_info_json = json.dumps(val_res.duplicate_info) if val_res.duplicate_info else None
        val_rec.errors_count = val_res.errors_count
        val_rec.warnings_count = val_res.warnings_count
        val_rec.passed_count = val_res.passed_count

        rec.updated_at = datetime.utcnow()
        if rec.status == "failed":
            rec.status = "processed"

        # Add History Entry
        note_str = correction.edit_note or "; ".join(changes) or "Manual invoice values edited"
        history = ProcessingHistoryRecord(
            document_id=rec.id,
            action="manually_corrected",
            details=f"Manual correction applied: {note_str}. Status updated to {val_res.validation_status.value.upper()}.",
            timestamp=datetime.utcnow(),
        )
        db.add(history)

        db.commit()
        db.refresh(rec)
        return cls.record_to_response(rec)

    @classmethod
    def reprocess_document(cls, db: Session, doc_id: str) -> Optional[DocumentResponse]:
        rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
        if not rec:
            return None

        # Look for raw content
        content: Optional[bytes] = None
        if rec.raw_file_path and Path(rec.raw_file_path).exists():
            content = Path(rec.raw_file_path).read_bytes()
        elif (SAMPLE_DIR / rec.filename).exists():
            content = (SAMPLE_DIR / rec.filename).read_bytes()

        if not content:
            # Cannot reprocess without source bytes
            history = ProcessingHistoryRecord(
                document_id=rec.id,
                action="reprocess_failed",
                details="Raw document file not found on disk for reprocessing.",
                timestamp=datetime.utcnow(),
            )
            db.add(history)
            db.commit()
            return cls.record_to_response(rec)

        # Reprocess with DocumentPipeline passing existing file_id
        new_doc_response = DocumentPipeline.process_single_file(
            filename=rec.filename,
            content=content,
            content_type=rec.file_type,
            file_id=rec.id,
        )

        # Save updated data
        updated_rec = cls.save_document_response(
            db=db,
            doc_resp=new_doc_response,
            raw_content=content,
            action_note="Document reprocessed from raw file bytes.",
        )
        return cls.record_to_response(updated_rec)
