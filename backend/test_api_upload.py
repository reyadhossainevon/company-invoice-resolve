import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.services.pipeline import DocumentPipeline
from app.config import ALLOWED_EXTENSIONS

def test_api_pipeline():
    sample_dir = backend_dir / "sample_data" / "files"
    print("AI Document Intelligence - API & Pipeline Sanity Test")
    print(f"Supported Extensions ({len(ALLOWED_EXTENSIONS)}): {sorted(list(ALLOWED_EXTENSIONS))}")

    samples = [
        "sample_sales_transactions.csv",
        "sample_multi_sheet_inventory.xlsx",
        "sample_digital_service_agreement.pdf",
        "sample_scanned_receipt.png",
        "sample_corrupted_document.pdf",
        "sample_empty_file.csv",
    ]

    for fname in samples:
        fpath = sample_dir / fname
        content = fpath.read_bytes() if fpath.exists() else b""
        res = DocumentPipeline.process_single_file(filename=fname, content=content)
        print(f"[{res.status.value.upper()}] {res.filename} -> {res.metadata.extraction_method.value} ({res.metadata.processing_time_ms} ms)")

if __name__ == "__main__":
    test_api_pipeline()
