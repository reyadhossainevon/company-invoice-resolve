import os
from pathlib import Path
import cv2
import numpy as np
import pandas as pd
import pymupdf

# Target directories: User's Desktop and workspace backup folder
DESKTOP_DIR = Path(os.path.expanduser("~")) / "Desktop" / "Test_Invoices_For_Upload"
WORKSPACE_DIR = Path(__file__).resolve().parent.parent / "Test_Invoices_For_Upload"

for d in [DESKTOP_DIR, WORKSPACE_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def create_valid_walton_pdf(out_dir: Path):
    """1. Valid PDF invoice in BDT."""
    path = out_dir / "01_valid_invoice_walton.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    page.insert_text(pymupdf.Point(50, 60), "TAX INVOICE / CHALLAN", fontsize=22, color=(0.1, 0.25, 0.5))
    page.insert_text(pymupdf.Point(50, 85), "Walton Hi-Tech Industries PLC", fontsize=11, color=(0.2, 0.2, 0.2))
    page.insert_text(pymupdf.Point(50, 100), "Plot 1088, Block I, Sabrina Sobhan Road, Bashundhara R/A, Dhaka-1229", fontsize=9, color=(0.4, 0.4, 0.4))

    page.draw_rect(pymupdf.Rect(50, 120, 545, 180), color=(0.85, 0.88, 0.95), fill=(0.96, 0.98, 1.0))
    page.insert_text(pymupdf.Point(60, 142), "Invoice #: INV-WALTON-2026-01", fontsize=10)
    page.insert_text(pymupdf.Point(60, 162), "Invoice Date: 2026-03-10", fontsize=10)
    page.insert_text(pymupdf.Point(310, 142), "Supplier: Walton Hi-Tech Industries", fontsize=10)
    page.insert_text(pymupdf.Point(310, 162), "Customer: Care Guide BD", fontsize=10)

    page.draw_rect(pymupdf.Rect(50, 200, 545, 225), color=(0.2, 0.35, 0.65), fill=(0.2, 0.35, 0.65))
    page.insert_text(pymupdf.Point(60, 218), "Description", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(300, 218), "Qty", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(370, 218), "Unit Price", fontsize=10, color=(1, 1, 1))
    page.insert_text(pymupdf.Point(470, 218), "Line Total", fontsize=10, color=(1, 1, 1))

    page.insert_text(pymupdf.Point(60, 250), "Walton Primo GH11 4G Smartphone (64GB)", fontsize=9.5)
    page.insert_text(pymupdf.Point(305, 250), "2", fontsize=9.5)
    page.insert_text(pymupdf.Point(375, 250), "15,000.00", fontsize=9.5)
    page.insert_text(pymupdf.Point(475, 250), "30,000.00", fontsize=9.5)

    page.insert_text(pymupdf.Point(60, 280), "Walton Inverter Split Air Conditioner 1.5 Ton", fontsize=9.5)
    page.insert_text(pymupdf.Point(305, 280), "1", fontsize=9.5)
    page.insert_text(pymupdf.Point(375, 280), "20,000.00", fontsize=9.5)
    page.insert_text(pymupdf.Point(475, 280), "20,000.00", fontsize=9.5)

    page.draw_rect(pymupdf.Rect(320, 310, 545, 395), color=(0.85, 0.88, 0.95), fill=(0.97, 0.98, 1.0))
    page.insert_text(pymupdf.Point(340, 335), "Subtotal: BDT 50,000.00", fontsize=10.5)
    page.insert_text(pymupdf.Point(340, 355), "VAT (15%): BDT 7,500.00", fontsize=10.5)
    page.draw_line(pymupdf.Point(330, 368), pymupdf.Point(535, 368), color=(0.2, 0.35, 0.65), width=1.5)
    page.insert_text(pymupdf.Point(340, 388), "Total Amount: BDT 57,500.00", fontsize=12, color=(0.1, 0.45, 0.2))

    doc.save(path)
    doc.close()
    print("Created:", path)


def create_math_error_daraz_excel(out_dir: Path):
    """2. Excel (.xlsx) invoice with calculation mistake."""
    path = out_dir / "02_daraz_electronics_math_error.xlsx"

    header_data = {
        "Field": ["Invoice Number", "Invoice Date", "Supplier Name", "Customer Name", "Currency", "Subtotal", "Tax", "Grand Total"],
        "Value": ["INV-DARAZ-2026-02", "2026-03-12", "Daraz Bangladesh Ltd", "Care Guide BD", "BDT", 20000.00, 3000.00, 25000.00],
    }

    items_data = {
        "Item #": [1],
        "Description": ["Logitech Wireless Combo Keyboard & Mouse MK270"],
        "Quantity": [10],
        "Unit Price (BDT)": [2000.00],
        "Line Total (BDT)": [20000.00],
    }

    audit_data = {
        "Audit Note": ["Subtotal (20,000) + VAT (3,000) equals 23,000 BDT, but printed total is written as 25,000 BDT."],
        "Expected Status": ["Needs Review / Math Mismatch Error"],
    }

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        pd.DataFrame(header_data).to_excel(writer, sheet_name="Invoice_Summary", index=False)
        pd.DataFrame(items_data).to_excel(writer, sheet_name="Line_Items", index=False)
        pd.DataFrame(audit_data).to_excel(writer, sheet_name="Validation_Audit", index=False)

    print("Created:", path)


def create_missing_info_aarong_csv(out_dir: Path):
    """3. CSV spreadsheet with missing supplier info."""
    path = out_dir / "03_aarong_retail_missing_fields.csv"
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
        "Subtotal": [15000.00, 15000.00],
        "Total": [15000.00, 15000.00],
    }
    pd.DataFrame(data).to_csv(path, index=False)
    print("Created:", path)


def create_clean_beximco_png(out_dir: Path):
    """4. Clean PNG invoice image with high contrast text for OCR."""
    path = out_dir / "04_beximco_pharma_invoice.png"
    w, h = 900, 650
    img = np.ones((h, w, 3), dtype=np.uint8) * 255

    # Top border bar
    cv2.rectangle(img, (0, 0), (w, 15), (130, 60, 20), -1)

    # Header
    cv2.putText(img, "PHARMACEUTICAL COMMERCIAL INVOICE", (50, 65), cv2.FONT_HERSHEY_DUPLEX, 0.9, (20, 20, 20), 2)
    cv2.putText(img, "Beximco Pharmaceuticals Ltd | Dhaka, Bangladesh", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 1)

    # Meta box
    cv2.rectangle(img, (50, 125), (w - 50, 200), (240, 240, 240), -1)
    cv2.rectangle(img, (50, 125), (w - 50, 200), (200, 200, 200), 1)
    cv2.putText(img, "Invoice #: INV-BEX-2026-99", (70, 155), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1)
    cv2.putText(img, "Date: 2026-03-18", (70, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1)
    cv2.putText(img, "Supplier: Beximco Pharmaceuticals Ltd", (420, 155), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1)
    cv2.putText(img, "Customer: Care Guide BD", (420, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1)

    # Table Header
    cv2.rectangle(img, (50, 220), (w - 50, 255), (130, 60, 20), -1)
    cv2.putText(img, "Description", (70, 244), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(img, "Qty", (450, 244), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(img, "Unit Price", (550, 244), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(img, "Total (BDT)", (700, 244), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    # Row 1
    cv2.putText(img, "Napa Extra 500mg Paracetamol", (70, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "50", (460, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "400.00", (560, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "20,000.00", (710, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.line(img, (50, 310), (w - 50, 310), (220, 220, 220), 1)

    # Row 2
    cv2.putText(img, "Neoflam Sterile Surgical Gloves", (70, 345), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "20", (460, 345), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "1,000.00", (560, 345), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.putText(img, "20,000.00", (710, 345), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (40, 40, 40), 1)
    cv2.line(img, (50, 365), (w - 50, 365), (220, 220, 220), 1)

    # Summary Box
    cv2.rectangle(img, (500, 395), (w - 50, 520), (248, 248, 250), -1)
    cv2.rectangle(img, (500, 395), (w - 50, 520), (210, 210, 215), 1)
    cv2.putText(img, "Subtotal: BDT 40,000.00", (520, 430), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (40, 40, 40), 1)
    cv2.putText(img, "VAT (15%): BDT 6,000.00", (520, 465), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (40, 40, 40), 1)
    cv2.line(img, (510, 480), (w - 60, 480), (130, 60, 20), 2)
    cv2.putText(img, "Total: BDT 46,000.00", (520, 508), cv2.FONT_HERSHEY_DUPLEX, 0.65, (20, 100, 30), 2)

    cv2.imwrite(str(path), img)
    print("Created:", path)


def generate_all(target_dir: Path):
    create_valid_walton_pdf(target_dir)
    create_math_error_daraz_excel(target_dir)
    create_missing_info_aarong_csv(target_dir)
    create_clean_beximco_png(target_dir)


if __name__ == "__main__":
    print("Generating files in Desktop folder...")
    generate_all(DESKTOP_DIR)
    print("Generating files in Workspace folder...")
    generate_all(WORKSPACE_DIR)
    print("Done generating 4 test invoices!")
