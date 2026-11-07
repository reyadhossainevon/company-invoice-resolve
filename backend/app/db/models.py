import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    content_hash = Column(String(64), index=True, nullable=True)
    status = Column(String(32), index=True, nullable=False, default="queued")  # queued, processing, processed, failed
    raw_file_path = Column(String(512), nullable=True)

    page_count = Column(Integer, default=0)
    sheet_names_json = Column(Text, default="[]")
    processing_time_ms = Column(Float, default=0.0)
    extraction_method = Column(String(64), default="none")

    error_code = Column(String(64), nullable=True)
    error_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    extracted_invoice = relationship(
        "ExtractedInvoiceRecord", uselist=False, back_populates="document", cascade="all, delete-orphan"
    )
    validation_result = relationship(
        "ValidationResultRecord", uselist=False, back_populates="document", cascade="all, delete-orphan"
    )
    history_logs = relationship(
        "ProcessingHistoryRecord", back_populates="document", order_by="ProcessingHistoryRecord.timestamp.asc()", cascade="all, delete-orphan"
    )

    @property
    def sheet_names(self) -> List[str]:
        try:
            return json.loads(self.sheet_names_json or "[]")
        except Exception:
            return []


class ExtractedInvoiceRecord(Base):
    __tablename__ = "extracted_invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), index=True, unique=True)

    invoice_number = Column(String(128), index=True, nullable=True)
    invoice_date = Column(String(32), index=True, nullable=True)
    supplier_name = Column(String(255), index=True, nullable=True)
    customer_name = Column(String(255), index=True, nullable=True)
    currency = Column(String(16), default="USD")

    subtotal = Column(Float, nullable=True)
    tax = Column(Float, nullable=True)
    total = Column(Float, nullable=True)

    line_items_json = Column(Text, default="[]")
    extraction_confidence = Column(Float, default=0.0)
    extraction_engine = Column(String(64), default="deterministic")
    uncertain_fields_json = Column(Text, default="[]")
    missing_fields_json = Column(Text, default="[]")

    raw_text_summary = Column(Text, nullable=True)
    pages_json = Column(Text, default="[]")
    sheets_json = Column(Text, default="{}")

    document = relationship("DocumentRecord", back_populates="extracted_invoice")

    @property
    def line_items(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.line_items_json or "[]")
        except Exception:
            return []

    @property
    def uncertain_fields(self) -> List[str]:
        try:
            return json.loads(self.uncertain_fields_json or "[]")
        except Exception:
            return []

    @property
    def missing_fields(self) -> List[str]:
        try:
            return json.loads(self.missing_fields_json or "[]")
        except Exception:
            return []


class ValidationResultRecord(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), index=True, unique=True)

    validation_status = Column(String(32), index=True, default="valid")  # valid, needs_review, invalid
    requires_manual_review = Column(Boolean, default=False)
    confidence_score = Column(Float, default=0.0)

    rule_results_json = Column(Text, default="[]")
    duplicate_info_json = Column(Text, nullable=True)

    errors_count = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    passed_count = Column(Integer, default=0)

    document = relationship("DocumentRecord", back_populates="validation_result")

    @property
    def rule_results(self) -> List[Dict[str, Any]]:
        try:
            return json.loads(self.rule_results_json or "[]")
        except Exception:
            return []

    @property
    def duplicate_info(self) -> Optional[Dict[str, Any]]:
        if not self.duplicate_info_json:
            return None
        try:
            return json.loads(self.duplicate_info_json)
        except Exception:
            return None


class ProcessingHistoryRecord(Base):
    __tablename__ = "processing_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    action = Column(String(64), nullable=False)  # uploaded, processed, manually_corrected, reprocessed, failed
    details = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    document = relationship("DocumentRecord", back_populates="history_logs")
