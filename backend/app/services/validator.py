import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.extraction import (
    DocumentValidationResult,
    InvoiceExtractionData,
    ValidationRuleResult,
    ValidationRuleStatus,
    ValidationStatus,
)

logger = logging.getLogger(__name__)


class InvoiceRegistry:
    """
    In-memory registry tracking processed invoices to detect duplicates
    across invoice number + supplier name or identical content hash.
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InvoiceRegistry, cls).__new__(cls)
            cls._instance._registry: Dict[str, Dict[str, Any]] = {}  # key -> doc info
            cls._instance._content_hashes: Dict[str, Dict[str, Any]] = {}  # hash -> doc info
        return cls._instance

    def check_and_register(
        self,
        doc_id: str,
        filename: str,
        invoice_number: Optional[str],
        supplier_name: Optional[str],
        raw_content: Optional[bytes] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Checks if the invoice is a duplicate.
        Returns: (is_duplicate, duplicate_details)
        """
        # 1. Content Hash check
        if raw_content:
            chash = hashlib.sha256(raw_content).hexdigest()
            if chash in self._content_hashes:
                existing = self._content_hashes[chash]
                if existing["doc_id"] != doc_id:
                    return True, {
                        "type": "exact_file_hash",
                        "matched_doc_id": existing["doc_id"],
                        "matched_filename": existing["filename"],
                        "registered_at": existing["timestamp"],
                    }
            else:
                self._content_hashes[chash] = {
                    "doc_id": doc_id,
                    "filename": filename,
                    "timestamp": datetime.now().isoformat(),
                }

        # 2. Composite Key check (Invoice Number + Supplier)
        if invoice_number and supplier_name:
            norm_key = f"{invoice_number.strip().lower()}:::{supplier_name.strip().lower()}"
            if norm_key in self._registry:
                existing = self._registry[norm_key]
                if existing["doc_id"] != doc_id:
                    return True, {
                        "type": "invoice_number_and_supplier",
                        "matched_doc_id": existing["doc_id"],
                        "matched_filename": existing["filename"],
                        "invoice_number": invoice_number,
                        "supplier_name": supplier_name,
                        "registered_at": existing["timestamp"],
                    }
            else:
                self._registry[norm_key] = {
                    "doc_id": doc_id,
                    "filename": filename,
                    "timestamp": datetime.now().isoformat(),
                }

        return False, None

    def clear(self):
        """Clears registry for testing."""
        self._registry.clear()
        self._content_hashes.clear()


class DataValidationEngine:
    """
    Comprehensive validation engine:
    1. Missing critical fields check
    2. Numeric & format validation
    3. Mathematical cross-verification (line item sum, subtotal + tax = total, qty * price = line_total)
    4. Duplicate invoice detection
    5. Manual review flagging
    """

    TOLERANCE = 0.02  # Floating-point tolerance for financial calculations

    @classmethod
    def validate(
        cls,
        doc_id: str,
        filename: str,
        extraction_data: InvoiceExtractionData,
        raw_content: Optional[bytes] = None,
    ) -> DocumentValidationResult:
        rules: List[ValidationRuleResult] = []

        # ---------------------------------------------------------------------
        # 1. MISSING CRITICAL FIELDS CHECK
        # ---------------------------------------------------------------------
        critical_fields = [
            ("invoice_number", extraction_data.invoice_number, "Invoice Number"),
            ("invoice_date", extraction_data.invoice_date, "Invoice Date"),
            ("supplier_name", extraction_data.supplier_name, "Supplier / Vendor Name"),
            ("total", extraction_data.total, "Grand Total"),
            ("currency", extraction_data.currency, "Currency Code"),
        ]

        missing_critical = []
        for f_key, f_val, f_label in critical_fields:
            if f_val is None or (isinstance(f_val, str) and not f_val.strip()):
                missing_critical.append(f_label)

        if missing_critical:
            rules.append(
                ValidationRuleResult(
                    rule_id="CRIT_001",
                    rule_name="Critical Fields Completeness",
                    category="critical_fields",
                    status=ValidationRuleStatus.FAILED,
                    message=f"Missing {len(missing_critical)} critical field(s): {', '.join(missing_critical)}.",
                    expected="All critical fields present",
                    actual=f"Missing: {', '.join(missing_critical)}",
                )
            )
        else:
            rules.append(
                ValidationRuleResult(
                    rule_id="CRIT_001",
                    rule_name="Critical Fields Completeness",
                    category="critical_fields",
                    status=ValidationRuleStatus.PASSED,
                    message="All 5 critical fields (Invoice #, Date, Supplier, Total, Currency) are present.",
                )
            )

        # ---------------------------------------------------------------------
        # 2. NUMERIC & FORMAT VALIDATION
        # ---------------------------------------------------------------------
        # Total must not be negative
        if extraction_data.total is not None:
            if extraction_data.total < 0:
                rules.append(
                    ValidationRuleResult(
                        rule_id="NUM_001",
                        rule_name="Non-Negative Total",
                        category="numeric_format",
                        status=ValidationRuleStatus.FAILED,
                        message=f"Invoice total cannot be negative ({extraction_data.total}) unless designated as a credit note.",
                        expected="Total >= 0.00",
                        actual=str(extraction_data.total),
                    )
                )
            else:
                rules.append(
                    ValidationRuleResult(
                        rule_id="NUM_001",
                        rule_name="Non-Negative Total",
                        category="numeric_format",
                        status=ValidationRuleStatus.PASSED,
                        message="Invoice total is positive and non-negative.",
                    )
                )

        # Valid ISO Date
        if extraction_data.invoice_date:
            try:
                datetime.strptime(extraction_data.invoice_date, "%Y-%m-%d")
                rules.append(
                    ValidationRuleResult(
                        rule_id="NUM_002",
                        rule_name="ISO Date Format",
                        category="numeric_format",
                        status=ValidationRuleStatus.PASSED,
                        message=f"Invoice date is valid ISO 8601 ({extraction_data.invoice_date}).",
                    )
                )
            except ValueError:
                rules.append(
                    ValidationRuleResult(
                        rule_id="NUM_002",
                        rule_name="ISO Date Format",
                        category="numeric_format",
                        status=ValidationRuleStatus.FAILED,
                        message=f"Date '{extraction_data.invoice_date}' does not conform to valid YYYY-MM-DD format.",
                        expected="YYYY-MM-DD",
                        actual=str(extraction_data.invoice_date),
                    )
                )

        # ---------------------------------------------------------------------
        # 3. MATHEMATICAL CROSS-VERIFICATION
        # ---------------------------------------------------------------------
        # Rule 3A: Subtotal + Tax == Total
        sub = extraction_data.subtotal
        tax = extraction_data.tax if extraction_data.tax is not None else 0.0
        tot = extraction_data.total

        if sub is not None and tot is not None:
            expected_total = round(sub + tax, 2)
            diff = round(abs(expected_total - tot), 2)
            curr_sym = "৳" if (not extraction_data.currency or extraction_data.currency == "BDT") else (extraction_data.currency or "")
            if diff > cls.TOLERANCE:
                rules.append(
                    ValidationRuleResult(
                        rule_id="MATH_001",
                        rule_name="Subtotal + Tax Cross-Verification",
                        category="math_verification",
                        status=ValidationRuleStatus.FAILED,
                        message=(
                            f"Calculation Mistake: Subtotal ({curr_sym} {sub:,.0f}) + VAT ({curr_sym} {tax:,.0f}) should be {curr_sym} {expected_total:,.0f}, "
                            f"but the invoice says {curr_sym} {tot:,.0f}. (Difference: {curr_sym} {diff:,.0f})"
                        ),
                        expected=f"{curr_sym} {expected_total:,.2f}",
                        actual=f"{curr_sym} {tot:,.2f}",
                    )
                )
            else:
                rules.append(
                    ValidationRuleResult(
                        rule_id="MATH_001",
                        rule_name="Subtotal + Tax Cross-Verification",
                        category="math_verification",
                        status=ValidationRuleStatus.PASSED,
                        message=f"Mathematical check passed: Subtotal ({curr_sym} {sub:,.2f}) + VAT ({curr_sym} {tax:,.2f}) == Total ({curr_sym} {tot:,.2f}).",
                    )
                )

        # Rule 3B: Sum of Line Items == Subtotal
        if extraction_data.line_items and sub is not None:
            line_totals = [li.line_total for li in extraction_data.line_items if li.line_total is not None]
            if len(line_totals) == len(extraction_data.line_items):
                calc_subtotal = round(sum(line_totals), 2)
                diff = round(abs(calc_subtotal - sub), 2)
                if diff > cls.TOLERANCE:
                    rules.append(
                        ValidationRuleResult(
                            rule_id="MATH_002",
                            rule_name="Line Items Sum vs Subtotal",
                            category="math_verification",
                            status=ValidationRuleStatus.FAILED,
                            message=(
                                f"Sum of {len(line_totals)} line item(s) is {calc_subtotal:.2f}, "
                                f"which does not match recorded Subtotal ({sub:.2f}). Difference: {diff:.2f}."
                            ),
                            expected=f"{sub:.2f}",
                            actual=f"{calc_subtotal:.2f}",
                        )
                    )
                else:
                    rules.append(
                        ValidationRuleResult(
                            rule_id="MATH_002",
                            rule_name="Line Items Sum vs Subtotal",
                            category="math_verification",
                            status=ValidationRuleStatus.PASSED,
                            message=f"Line items sum verification passed: {calc_subtotal:.2f} == Subtotal ({sub:.2f}).",
                        )
                    )

        # Rule 3C: Line Item Arithmetic (Qty * Unit Price == Line Total)
        if extraction_data.line_items:
            mismatched_items = []
            for idx, li in enumerate(extraction_data.line_items):
                if li.quantity is not None and li.unit_price is not None and li.line_total is not None:
                    expected_lt = round(li.quantity * li.unit_price, 2)
                    if round(abs(expected_lt - li.line_total), 2) > cls.TOLERANCE:
                        mismatched_items.append(
                            f"Item #{idx+1} ('{li.description or 'Item'}'): Qty {li.quantity} * Rate {li.unit_price:.2f} = {expected_lt:.2f}, but got {li.line_total:.2f}"
                        )

            if mismatched_items:
                rules.append(
                    ValidationRuleResult(
                        rule_id="MATH_003",
                        rule_name="Line Item Unit Price Arithmetic",
                        category="line_item_math",
                        status=ValidationRuleStatus.FAILED,
                        message=f"{len(mismatched_items)} line item arithmetic mismatch(es): {'; '.join(mismatched_items)}",
                        expected="Qty * Unit Price == Line Total",
                        actual=f"{len(mismatched_items)} mismatch(es)",
                    )
                )
            else:
                rules.append(
                    ValidationRuleResult(
                        rule_id="MATH_003",
                        rule_name="Line Item Unit Price Arithmetic",
                        category="line_item_math",
                        status=ValidationRuleStatus.PASSED,
                        message=f"All {len(extraction_data.line_items)} line item arithmetic equations verified (Qty * Price == Total).",
                    )
                )

        # ---------------------------------------------------------------------
        # 4. DUPLICATE INVOICE DETECTION
        # ---------------------------------------------------------------------
        registry = InvoiceRegistry()
        is_dup, dup_info = registry.check_and_register(
            doc_id=doc_id,
            filename=filename,
            invoice_number=extraction_data.invoice_number,
            supplier_name=extraction_data.supplier_name,
            raw_content=raw_content,
        )

        if is_dup and dup_info:
            rules.append(
                ValidationRuleResult(
                    rule_id="DUP_001",
                    rule_name="Duplicate Invoice Detection",
                    category="duplicate_detection",
                    status=ValidationRuleStatus.FAILED,
                    message=(
                        f"Duplicate detected: Matches previously uploaded document '{dup_info.get('matched_filename')}' "
                        f"(Invoice #{extraction_data.invoice_number or 'N/A'} from '{extraction_data.supplier_name or 'N/A'}')."
                    ),
                    expected="Unique Invoice",
                    actual=f"Duplicate of {dup_info.get('matched_filename')}",
                )
            )
        else:
            rules.append(
                ValidationRuleResult(
                    rule_id="DUP_001",
                    rule_name="Duplicate Invoice Detection",
                    category="duplicate_detection",
                    status=ValidationRuleStatus.PASSED,
                    message="Unique invoice: No duplicate entries found in document registry.",
                )
            )

        # ---------------------------------------------------------------------
        # 5. OVERALL STATUS & MANUAL REVIEW DETERMINATION
        # ---------------------------------------------------------------------
        failed_count = sum(1 for r in rules if r.status == ValidationRuleStatus.FAILED)
        warning_count = sum(1 for r in rules if r.status == ValidationRuleStatus.WARNING)
        passed_count = sum(1 for r in rules if r.status == ValidationRuleStatus.PASSED)

        requires_review = False
        confidence = extraction_data.extraction_confidence

        if is_dup:
            validation_status = ValidationStatus.INVALID
            requires_review = True
        elif failed_count > 0:
            validation_status = ValidationStatus.NEEDS_REVIEW
            requires_review = True
        elif confidence < 0.8:
            validation_status = ValidationStatus.NEEDS_REVIEW
            requires_review = True
            rules.append(
                ValidationRuleResult(
                    rule_id="CONF_001",
                    rule_name="Extraction Confidence Threshold",
                    category="critical_fields",
                    status=ValidationRuleStatus.WARNING,
                    message=f"Extraction confidence ({confidence:.2f}) is below 0.80 threshold. Manual review suggested.",
                    expected="Confidence >= 0.80",
                    actual=f"{confidence:.2f}",
                )
            )
            warning_count += 1
        else:
            validation_status = ValidationStatus.VALID
            requires_review = False

        return DocumentValidationResult(
            validation_status=validation_status,
            requires_manual_review=requires_review,
            confidence_score=confidence,
            rule_results=rules,
            errors_count=failed_count,
            warnings_count=warning_count,
            passed_count=passed_count,
            duplicate_info=dup_info if is_dup else None,
        )
