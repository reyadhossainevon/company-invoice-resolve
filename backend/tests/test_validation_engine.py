import pytest
from app.schemas.extraction import (
    InvoiceExtractionData,
    LineItem,
    ValidationStatus,
    ValidationRuleStatus,
)
from app.services.validator import DataValidationEngine, InvoiceRegistry


def test_validation_all_passed():
    registry = InvoiceRegistry()
    registry.clear()

    data = InvoiceExtractionData(
        invoice_number="INV-TEST-001",
        invoice_date="2026-01-15",
        supplier_name="Valid Vendor Inc",
        customer_name="Client Corp",
        currency="USD",
        subtotal=100.0,
        tax=10.0,
        total=110.0,
        line_items=[
            LineItem(description="Item A", quantity=2.0, unit_price=50.0, line_total=100.0)
        ],
        extraction_confidence=0.95,
    )
    result = DataValidationEngine.validate("doc-1", "test.pdf", data)
    assert result.validation_status == ValidationStatus.VALID
    assert result.requires_manual_review is False
    assert result.errors_count == 0


def test_validation_missing_critical_fields():
    registry = InvoiceRegistry()
    registry.clear()

    data = InvoiceExtractionData(
        invoice_number=None,  # Missing
        invoice_date=None,    # Missing
        supplier_name="Valid Vendor",
        currency="USD",
        subtotal=100.0,
        tax=10.0,
        total=110.0,
        line_items=[],
        extraction_confidence=0.9,
    )
    result = DataValidationEngine.validate("doc-2", "test.pdf", data)
    assert result.validation_status == ValidationStatus.NEEDS_REVIEW
    assert result.requires_manual_review is True
    crit_rule = next(r for r in result.rule_results if r.rule_id == "CRIT_001")
    assert crit_rule.status == ValidationRuleStatus.FAILED
    assert "Missing" in crit_rule.message


def test_validation_math_mismatch_total():
    registry = InvoiceRegistry()
    registry.clear()

    data = InvoiceExtractionData(
        invoice_number="INV-TEST-003",
        invoice_date="2026-02-10",
        supplier_name="Valid Vendor",
        currency="USD",
        subtotal=1000.0,
        tax=100.0,
        total=1250.0,  # Should be 1100.0!
        line_items=[
            LineItem(description="Freight", quantity=1.0, unit_price=1000.0, line_total=1000.0)
        ],
        extraction_confidence=0.95,
    )
    result = DataValidationEngine.validate("doc-3", "test.pdf", data)
    assert result.validation_status == ValidationStatus.NEEDS_REVIEW
    math_rule = next(r for r in result.rule_results if r.rule_id == "MATH_001")
    assert math_rule.status == ValidationRuleStatus.FAILED
    assert "Calculation Mistake" in math_rule.message or "discrepancy" in math_rule.message.lower()


def test_validation_line_item_math_mismatch():
    registry = InvoiceRegistry()
    registry.clear()

    data = InvoiceExtractionData(
        invoice_number="INV-TEST-004",
        invoice_date="2026-02-10",
        supplier_name="Hardware Store",
        currency="USD",
        subtotal=600.0,
        tax=60.0,
        total=660.0,
        line_items=[
            # 5 * 100.0 == 500.0, but line_total is given as 600.0
            LineItem(description="Switch", quantity=5.0, unit_price=100.0, line_total=600.0)
        ],
        extraction_confidence=0.95,
    )
    result = DataValidationEngine.validate("doc-4", "test.pdf", data)
    assert result.validation_status == ValidationStatus.NEEDS_REVIEW
    item_rule = next(r for r in result.rule_results if r.rule_id == "MATH_003")
    assert item_rule.status == ValidationRuleStatus.FAILED
    assert "arithmetic mismatch" in item_rule.message.lower()


def test_validation_negative_total():
    registry = InvoiceRegistry()
    registry.clear()

    data = InvoiceExtractionData(
        invoice_number="INV-TEST-005",
        invoice_date="2026-02-10",
        supplier_name="Vendor",
        currency="USD",
        subtotal=-100.0,
        tax=0.0,
        total=-100.0,
        line_items=[],
        extraction_confidence=0.9,
    )
    result = DataValidationEngine.validate("doc-5", "test.pdf", data)
    assert result.validation_status == ValidationStatus.NEEDS_REVIEW
    num_rule = next(r for r in result.rule_results if r.rule_id == "NUM_001")
    assert num_rule.status == ValidationRuleStatus.FAILED


def test_validation_duplicate_invoice():
    registry = InvoiceRegistry()
    registry.clear()

    data1 = InvoiceExtractionData(
        invoice_number="INV-DUP-999",
        invoice_date="2026-01-01",
        supplier_name="Acme Corp",
        currency="USD",
        subtotal=50.0,
        tax=5.0,
        total=55.0,
        line_items=[],
        extraction_confidence=0.95,
    )
    # Register first document
    res1 = DataValidationEngine.validate("doc-orig", "first.pdf", data1)
    assert res1.validation_status == ValidationStatus.VALID

    # Register second document with same invoice # and supplier
    data2 = InvoiceExtractionData(
        invoice_number="INV-DUP-999",
        invoice_date="2026-01-01",
        supplier_name="Acme Corp",
        currency="USD",
        subtotal=50.0,
        tax=5.0,
        total=55.0,
        line_items=[],
        extraction_confidence=0.95,
    )
    res2 = DataValidationEngine.validate("doc-duplicate", "second.pdf", data2)
    assert res2.validation_status == ValidationStatus.INVALID
    assert res2.duplicate_info is not None
    assert res2.duplicate_info["matched_doc_id"] == "doc-orig"
