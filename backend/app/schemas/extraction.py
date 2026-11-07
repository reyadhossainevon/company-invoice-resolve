from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None


class InvoiceExtractionData(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None  # Expected ISO format YYYY-MM-DD
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    line_items: List[LineItem] = Field(default_factory=list)
    extraction_confidence: float = 0.0  # 0.0 to 1.0
    extraction_engine: str = "deterministic"  # "gemini", "openai", "deterministic_regex", "spreadsheet_mapping"
    uncertain_fields: List[str] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
    raw_response: Optional[str] = None


class ValidationRuleStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"


class ValidationRuleResult(BaseModel):
    rule_id: str
    rule_name: str
    category: str  # "critical_fields", "math_verification", "line_item_math", "numeric_format", "duplicate_detection"
    status: ValidationRuleStatus
    message: str
    expected: Optional[str] = None
    actual: Optional[str] = None


class ValidationStatus(str, Enum):
    VALID = "valid"
    NEEDS_REVIEW = "needs_review"
    INVALID = "invalid"


class DocumentValidationResult(BaseModel):
    validation_status: ValidationStatus
    requires_manual_review: bool
    confidence_score: float
    rule_results: List[ValidationRuleResult] = Field(default_factory=list)
    errors_count: int = 0
    warnings_count: int = 0
    passed_count: int = 0
    duplicate_info: Optional[Dict[str, Any]] = None


class InvoiceCorrectionRequest(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    currency: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    line_items: Optional[List[LineItem]] = None
    edit_note: Optional[str] = None
