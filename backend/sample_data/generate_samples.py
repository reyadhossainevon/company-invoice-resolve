import os
from pathlib import Path
import cv2
import numpy as np
import pandas as pd
import pymupdf  # PyMuPDF

SAMPLE_DIR = Path(__file__).resolve().parent / "files"
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)


def clean_existing_samples():
    """Removes previous sample files so new ones are clean and numbered."""
    for f in SAMPLE_DIR.iterdir():
        if f.is_file():
            try:
                f.unlink()
            except Exception:
                pass


def generate_walton_valid_pdf():
    """
    Scenario 1: Completely valid Bangladeshi invoice in BDT.
    Supplier: Walton Hi-Tech Industries PLC
    Customer: Care Guide BD
    Subtotal: BDT 50,000.00
    VAT (15%): BDT 7,500.00
    Total: BDT 57,500.00
    Math check: 50,000 + 7,500 = 57,500 -> Status: Verified
    """
    filepath = SAMPLE_DIR / "01_valid_invoice_walton.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Header
    page.insert_text(pymupdf.Point(50, 55), "TAX INVOICE / CHALLAN", fontsize=20, color=(0.1, 0.25, 0.5))
    page.insert_text(pymupdf.Point(50, 78), "Walton Hi-Tech Industries PLC | Electronics & Appliances Division", fontsize=10, color=(0.3, 0.3, 0.3))
    page.insert_text(pymupdf.Point(50, 92), "Plot 1088, Block I, Sabrina Sobhan Road, Bashundhara R/A, Dhaka-1229, Bangladesh", fontsize=8.5, color=(0.45, 0.45, 0.45))

    # Meta Section
    page.draw_rect(pymupdf.Rect(50, 110, 545, 175), color=(0.85, 0.88, 0.95), fill=(0.96, 0.98, 1.0))
    page.insert_text(pymupdf.Point(60, 130), "Invoice #: INV-WALTON-2026-01", fontsize=10.5)
    page.insert_text(pymupdf.Point(60, 148), "Invoice Date: 2026-03-10", fontsize=10.5)
    page.insert_text(pymupdf.Point(60, 166), "Due Date: 2026-04-10", fontsize=10.5)

    page.insert_text(pymupdf.Point(310, 130), "Supplier: Walton Hi-Tech Industries", fontsize=10.5)
    page.insert_text(pymupdf.Point(310, 148), "Customer: Care Guide BD", fontsize=10.5)
    page.insert_text(pymupdf.Point(310, 166), "Currency: BDT", fontsize=10.5)

    # Line Items Table Header
    page.draw_rect(pymupdf.Rect(50, 195, 545, 218), color=(0.2, 0.35, 0.65), fill=(0.2, 0.35, 0.65))
    page.insert_text(pymupdf.Point(60, 211), "Description", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(300, 211), "Qty", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(370, 211), "Unit Price (BDT)", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(475, 211), "Line Total (BDT)", fontsize=10, color=(1, 1, 1))

    # Line items (sequential multi-line format friendly for PyMuPDF)
    items = [
        ("Walton Primo GH11 4G Smartphone (64GB)", "2", "15,000.00", "30,000.00", 245),
        ("Walton Inverter Split Air Conditioner 1.5 Ton", "1", "20,000.00", "20,000.00", 275),
    ]

    for desc, qty, price, total, y in items:
        page.insert_text(pymupdf.Point(60, y), desc, fontsize=9.5)
        page.insert_text(pymupdf.Point(305, y), qty, fontsize=9.5)
        page.insert_text(pymupdf.Point(375, y), price, fontsize=9.5)
        page.insert_text(pymupdf.Point(480, y), total, fontsize=9.5)
        page.draw_line(pymupdf.Point(50, y + 10), pymupdf.Point(545, y + 10), color=(0.9, 0.9, 0.9))

    # Financial Summary
    page.draw_rect(pymupdf.Rect(320, 310, 545, 395), color=(0.85, 0.88, 0.95), fill=(0.97, 0.98, 1.0))
    page.insert_text(pymupdf.Point(340, 332), "Subtotal: BDT 50,000.00", fontsize=10.5)
    page.insert_text(pymupdf.Point(340, 352), "VAT (15%): BDT 7,500.00", fontsize=10.5)
    page.draw_line(pymupdf.Point(330, 365), pymupdf.Point(535, 365), color=(0.2, 0.35, 0.65), width=1.5)
    page.insert_text(pymupdf.Point(340, 385), "Total Amount: BDT 57,500.00", fontsize=12, color=(0.1, 0.45, 0.2))

    # Footer note
    page.insert_text(pymupdf.Point(50, 420), "Terms & Notes: 100% Genuine Walton Electronics. Official 1-Year Comprehensive Warranty.", fontsize=8.5, color=(0.4, 0.4, 0.4))
    page.insert_text(pymupdf.Point(50, 435), "Payment received in full via City Bank Bangladesh RTGS.", fontsize=8.5, color=(0.4, 0.4, 0.4))

    doc.save(filepath)
    doc.close()
    print(f"Generated 01: {filepath.name}")


def generate_daraz_wrong_math_pdf():
    """
    Scenario 2: Bangladeshi invoice with intentional mathematical mismatch.
    Supplier: Daraz Bangladesh Ltd
    Customer: Care Guide BD
    Subtotal: BDT 20,000.00
    VAT: BDT 3,000.00
    Printed Total: BDT 25,000.00 (Should be 23,000.00)
    Triggers: Calculation Mistake / Math Error
    """
    filepath = SAMPLE_DIR / "02_wrong_math_daraz.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    page.insert_text(pymupdf.Point(50, 55), "COMMERCIAL INVOICE", fontsize=20, color=(0.7, 0.15, 0.15))
    page.insert_text(pymupdf.Point(50, 78), "Daraz Bangladesh Ltd | Corporate Procurement Solutions", fontsize=10, color=(0.3, 0.3, 0.3))
    page.insert_text(pymupdf.Point(50, 92), "Asfia Tower, House 76, Road 11, Block D, Banani, Dhaka-1213, Bangladesh", fontsize=8.5, color=(0.45, 0.45, 0.45))

    page.draw_rect(pymupdf.Rect(50, 110, 545, 175), color=(0.95, 0.88, 0.88), fill=(1.0, 0.97, 0.97))
    page.insert_text(pymupdf.Point(60, 130), "Invoice #: INV-DARAZ-2026-02", fontsize=10.5)
    page.insert_text(pymupdf.Point(60, 148), "Invoice Date: 2026-03-12", fontsize=10.5)
    page.insert_text(pymupdf.Point(310, 130), "Supplier: Daraz Bangladesh Ltd", fontsize=10.5)
    page.insert_text(pymupdf.Point(310, 148), "Customer: Care Guide BD", fontsize=10.5)
    page.insert_text(pymupdf.Point(310, 166), "Currency: BDT", fontsize=10.5)

    # Line item
    page.draw_rect(pymupdf.Rect(50, 195, 545, 218), color=(0.6, 0.15, 0.15), fill=(0.6, 0.15, 0.15))
    page.insert_text(pymupdf.Point(60, 211), "Description", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(300, 211), "Qty", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(370, 211), "Unit Price (BDT)", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(475, 211), "Line Total (BDT)", fontsize=10, color=(1, 1, 1))

    page.insert_text(pymupdf.Point(60, 245), "Logitech Wireless Combo Keyboard & Mouse MK270", fontsize=9.5)
    page.insert_text(pymupdf.Point(305, 245), "10", fontsize=9.5)
    page.insert_text(pymupdf.Point(375, 245), "2,000.00", fontsize=9.5)
    page.insert_text(pymupdf.Point(480, 245), "20,000.00", fontsize=9.5)

    # Mathematical Discrepancy
    page.draw_rect(pymupdf.Rect(320, 290, 545, 375), color=(0.95, 0.85, 0.85), fill=(1.0, 0.96, 0.96))
    page.insert_text(pymupdf.Point(340, 312), "Subtotal: BDT 20,000.00", fontsize=10.5)
    page.insert_text(pymupdf.Point(340, 332), "VAT (15%): BDT 3,000.00", fontsize=10.5)
    page.draw_line(pymupdf.Point(330, 345), pymupdf.Point(535, 345), color=(0.7, 0.15, 0.15), width=1.5)
    page.insert_text(pymupdf.Point(340, 365), "Grand Total: BDT 25,000.00", fontsize=12, color=(0.8, 0.1, 0.1))

    page.insert_text(
        pymupdf.Point(50, 400),
        "Audit Note: Subtotal (BDT 20,000) + VAT (BDT 3,000) = BDT 23,000, but invoice totals BDT 25,000.",
        fontsize=9,
        color=(0.6, 0.2, 0.2),
    )

    doc.save(filepath)
    doc.close()
    print(f"Generated 02: {filepath.name}")


def generate_aarong_missing_csv():
    """
    Scenario 3: Bangladeshi CSV document missing Supplier Name.
    Customer: Square Hospital
    Total: BDT 15,000.00
    Triggers: Missing Critical Fields (supplier_name)
    """
    filepath = SAMPLE_DIR / "03_missing_info_aarong.csv"
    data = {
        "Item_Description": [
            "Aarong Handwoven Cotton Scrub Sets (Navy Blue)",
            "Aarong Medical Staff Aprons (Pure White)",
        ],
        "Quantity": [20, 10],
        "Unit_Price_BDT": [500.00, 500.00],
        "Line_Total_BDT": [10000.00, 5000.00],
        "Customer_Name": ["Square Hospital", "Square Hospital"],
        "Invoice_Date": ["2026-03-14", "2026-03-14"],
        "Currency": ["BDT", "BDT"],
    }
    df = pd.DataFrame(data)
    df.to_csv(filepath, index=False)
    print(f"Generated 03: {filepath.name}")


def generate_beximco_ledger_excel():
    """
    Scenario 4: Multi-sheet Excel workbook in BDT.
    Supplier: Beximco Pharmaceuticals Ltd
    Customer: Care Guide BD
    Subtotal: BDT 80,000.00
    VAT (15%): BDT 12,000.00
    Total: BDT 92,000.00
    Sheets: Invoice_Header, Line_Items, Monthly_Summary
    Status: Verified
    """
    filepath = SAMPLE_DIR / "04_monthly_ledger_sheet.xlsx"

    header_data = {
        "Attribute": [
            "invoice_number",
            "invoice_date",
            "supplier_name",
            "customer_name",
            "currency",
            "subtotal",
            "tax",
            "total",
        ],
        "Value": [
            "PO-BEX-2026-4401",
            "2026-03-15",
            "Beximco Pharmaceuticals Ltd",
            "Care Guide BD",
            "BDT",
            80000.00,
            12000.00,
            92000.00,
        ],
    }

    items_data = {
        "Description": [
            "Napa Extra 500mg Paracetamol Tablets (Box of 200)",
            "Ace Plus 500mg/65mg Tablets (Box of 200)",
            "Neoflam Sterile Surgical Gloves Box (100 pcs)",
            "Disposable Syringes 5ml with Needle (Box of 100)",
        ],
        "Quantity": [50, 50, 20, 20],
        "Unit_Price": [400.00, 400.00, 1000.00, 1000.00],
        "Line_Total": [20000.00, 20000.00, 20000.00, 20000.00],
    }

    summary_data = {
        "Metric": ["Subtotal (BDT)", "VAT 15% (BDT)", "Grand Total (BDT)", "Payment Status"],
        "Details": ["80,000.00", "12,000.00", "92,000.00", "Approved for Disbursement"],
    }

    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        pd.DataFrame(header_data).to_excel(writer, sheet_name="Invoice_Header", index=False)
        pd.DataFrame(items_data).to_excel(writer, sheet_name="Line_Items", index=False)
        pd.DataFrame(summary_data).to_excel(writer, sheet_name="Monthly_Summary", index=False)

    print(f"Generated 04: {filepath.name}")


def generate_damaged_file():
    """Scenario 5: Damaged / Corrupted file testing pipeline isolation."""
    filepath = SAMPLE_DIR / "05_damaged_file.pdf"
    with open(filepath, "wb") as f:
        f.write(b"CORRUPTED_RAW_STREAM_NON_PDF_MAGIC_BYTES_BANGLADESH_TAKAS_123456789")
    print(f"Generated 05: {filepath.name}")


def generate_scanned_receipt_image():
    """Scenario 6: Synthetic receipt image for OCR deskewing and line item extraction."""
    filepath = SAMPLE_DIR / "06_scanned_receipt_ocr.png"
    img = np.ones((520, 700, 3), dtype=np.uint8) * 255

    cv2.putText(img, "EXPENSE RECEIPT - BEXIMCO PHARMA", (50, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
    cv2.putText(img, "Receipt #: REC-2026-9041", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (50, 50, 50), 1)
    cv2.putText(img, "Date: 2026-03-18", (50, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (70, 70, 70), 1)
    cv2.line(img, (50, 150), (650, 150), (100, 100, 100), 1)

    cv2.putText(img, "ITEM                           QTY    PRICE     TOTAL", (50, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (30, 30, 30), 1)
    cv2.putText(img, "Napa Extra Paracetamol          50    400.00   20,000.00", (50, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    cv2.putText(img, "Ace Plus Tablets 500mg          50    400.00   20,000.00", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    cv2.line(img, (50, 310), (650, 310), (100, 100, 100), 1)

    cv2.putText(img, "SUBTOTAL:                            BDT 40,000.00", (50, 345), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 2)
    cv2.putText(img, "VAT (15%):                            BDT 6,000.00", (50, 375), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (50, 50, 50), 1)
    cv2.putText(img, "TOTAL PAID:                          BDT 46,000.00", (50, 415), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 80, 20), 2)

    (h, w) = img.shape[:2]
    matrix = cv2.getRotationMatrix2D((w // 2, h // 2), 2.2, 1.0)
    skewed = cv2.warpAffine(img, matrix, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))

    cv2.imwrite(str(filepath), skewed)
    print(f"Generated 06: {filepath.name}")


def generate_all_samples():
    clean_existing_samples()
    generate_walton_valid_pdf()
    generate_daraz_wrong_math_pdf()
    generate_aarong_missing_csv()
    generate_beximco_ledger_excel()
    generate_damaged_file()
    generate_scanned_receipt_image()
    print("Successfully generated all sample documents!")


if __name__ == "__main__":
    generate_all_samples()
