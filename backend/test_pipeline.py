import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_path))

from app.services.pipeline import DocumentPipeline
from app.services.validator import InvoiceRegistry

def test_pipeline():
    sample_dir = backend_path / "sample_data" / "files"
    test_files = [
        "01_invoice_valid_techcorp.pdf",
        "02_invoice_math_mismatch.pdf",
        "03_invoice_missing_fields.csv",
        "04_invoice_duplicate.xlsx",
        "05_scanned_receipt_ocr.png",
        "06_sample_corrupted_file.pdf",
    ]

    # Reset registry so file 4 triggers duplicate against file 1
    InvoiceRegistry().clear()

    print("=" * 70)
    print("RUNNING END-TO-END PIPELINE: TASK 1 + TASK 2 + TASK 3")
    print("=" * 70)

    for filename in test_files:
        file_path = sample_dir / filename
        content = file_path.read_bytes() if file_path.exists() else b""
        res = DocumentPipeline.process_single_file(filename=filename, content=content)

        print(f"\n[FILE]: {res.filename}")
        print(f"  Status: {res.status.value.upper()}")
        print(f"  Ingestion Method: {res.metadata.extraction_method.value}")
        print(f"  Latency: {res.metadata.processing_time_ms} ms")

        if res.status.value == "processed":
            # Task 2 AI Extraction Output
            ext = res.extraction_data
            if ext:
                print(f"  -- TASK 2: AI INFORMATION EXTRACTION ({ext.extraction_engine}) --")
                print(f"     Invoice #: {ext.invoice_number} | Date: {ext.invoice_date}")
                print(f"     Supplier: {ext.supplier_name} | Customer: {ext.customer_name}")
                print(f"     Subtotal: {ext.subtotal} | Tax: {ext.tax} | Total: {ext.total} {ext.currency}")
                print(f"     Line Items: {len(ext.line_items)} items")
                print(f"     Confidence: {ext.extraction_confidence} | Missing Fields: {ext.missing_fields}")

            # Task 3 Validation Output
            val = res.validation_result
            if val:
                print(f"  -- TASK 3: DATA VALIDATION ENGINE --")
                print(f"     Validation Status: {val.validation_status.value.upper()}")
                print(f"     Requires Manual Review: {val.requires_manual_review}")
                print(f"     Rules Summary: {val.passed_count} Passed, {val.errors_count} Failed, {val.warnings_count} Warnings")
                for r in val.rule_results:
                    status_tag = f"[{r.status.value.upper()}]"
                    print(f"       {status_tag:8} {r.rule_name}: {r.message}")
        else:
            print(f"  Error Code: {res.error_details.error_code}")
            print(f"  Reason: {res.error_details.error_reason}")

    print("\n" + "=" * 70)
    print("END-TO-END INTEGRATION TEST COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    test_pipeline()
