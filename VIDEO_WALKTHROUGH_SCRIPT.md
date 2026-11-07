# 2-Minute Video Walkthrough Script & Demo Checklist
### DocuIntellect • AI-Powered Document Intelligence & Verification System (BDT ৳)

Use this step-by-step checklist when recording your screen for the assignment demo submission. The entire walkthrough takes **exactly 2 minutes** (120 seconds) and demonstrates all core requirements across Tasks 1 through 7.

---

## 🎬 Pre-Recording Setup (10 Seconds Before You Record)
1. Double-click `start_system.bat` (or run `.\start_system.ps1`) to launch both servers.
2. Open your browser to `http://localhost:5173`.
3. Set your browser zoom to 100% or 110% for crisp readability.
4. Hit **Record Screen**!

---

## ⏱️ Video Script & Click-by-Click Timeline

### 0:00 – 0:20 | Introduction & Clean UI Architecture
- **Voiceover:** *"Hello! Welcome to DocuIntellect, an enterprise AI Document Intelligence and Verification System customized for Bangladeshi businesses with native Bangladeshi Taka (৳ BDT) support."*
- **Action on Screen:**
  - Point your mouse at the top brand: **DocuIntellect**.
  - Highlight the **How to Use (3 Easy Steps)** strip:
    - Step 1: Upload PDF/Excel/Image
    - Step 2: AI checks BDT amounts & detects errors
    - Step 3: Interactive "Fix Now" mode
  - Briefly point to the **4 Summary Cards** (*Total Documents*, *Ready & Verified*, *Needs Attention*, *Failed to Read*).

---

### 0:20 – 0:45 | One-Click Demo Load & Multi-Format Ingestion (Tasks 1, 4, 5)
- **Voiceover:** *"Let's click 'Load Demo Invoices (BDT)' on the top right. In under 200 milliseconds, our streaming pipeline ingests multi-format PDFs, multi-sheet Excel workbooks, CSV files, and tests corrupted file isolation."*
- **Action on Screen:**
  - Click the **`🔄 Load Demo Invoices (BDT)`** button in the top navbar.
  - Watch the 5 demo files populate the left-hand column:
    1. `01_valid_invoice_walton.pdf` (`✅ All OK / Verified`)
    2. `02_wrong_math_daraz.pdf` (`⚠️ Calculation Wrong`)
    3. `03_missing_info_aarong.csv` (`⚠️ Missing Info`)
    4. `04_monthly_ledger_sheet.xlsx` (`✅ All OK / Verified`)
    5. `05_damaged_file.pdf` (`❌ Corrupted File`)

---

### 0:45 – 1:10 | AI Extraction & Mathematical Cross-Verification (Tasks 2 & 3)
- **Voiceover:** *"DocuIntellect enforces a strict Zero-Hallucination policy. Let's inspect Walton's valid invoice: all items, VAT, and subtotal match ৳ 57,500. Now let's look at Daraz: our validation engine instantly caught an arithmetic mismatch."*
- **Action on Screen:**
  - Click on **`01_valid_invoice_walton.pdf`**:
    - Show the green **"✅ Invoice is 100% Correct"** box.
    - Scroll down through the Challan Items Table (Smartphone ৳ 30,000 + AC ৳ 20,000 = ৳ 50,000 + 15% VAT ৳ 7,500 = **৳ 57,500**).
  - Click on **`02_wrong_math_daraz.pdf`**:
    - Point to the amber alert box:
      > *"⚠️ Calculation Mistake: Subtotal (৳ 20,000) + VAT (৳ 3,000) should be ৳ 23,000, but the invoice says ৳ 25,000."*

---

### 1:10 – 1:35 | Interactive "Edit & Fix" Human-in-the-Loop Mode (Task 6)
- **Voiceover:** *"With one click, an auditor can correct this mistake. Watch the status update from 'Calculation Wrong' to 'All OK / Verified' in real time!"*
- **Action on Screen:**
  - Click the **`✏️ Click Here to Fix Now`** button inside the alert box.
  - The interactive editor appears.
  - Change the **Grand Total** field from `25000` to `23000`.
  - Click **`Save & Re-Verify Calculations`**.
  - **Boom!** The alert immediately turns green: **"✅ Invoice is 100% Correct"** and the badge in the left list updates to `✅ All OK / Verified`!

---

### 1:35 – 1:50 | Smart Hybrid Search & PDF vs Excel Comparison (Task 5)
- **Voiceover:** *"Our single smart search box handles both keyword matching and conceptual semantic queries behind the scenes. We can also cross-check PDF challans against Excel ledgers side-by-side."*
- **Action on Screen:**
  - Type `square` or `hospital` into the search bar. Show that `03_missing_info_aarong.csv` instantly appears.
  - Clear the search bar.
  - Click the **`🔍 Compare PDF & Excel`** button in the top navbar.
  - Show the side-by-side comparison table between Document A (Walton PDF) and Document B (Beximco Excel ledger), comparing subtotals, VAT, and totals.
  - Click "Close Comparison".

---

### 1:50 – 2:00 | System Accuracy & Speed Report (Task 7 & Wrap-Up)
- **Voiceover:** *"Finally, let's open the Accuracy Report. Backed by 25 automated pytest tests with a 100% pass rate, our pipeline achieves 97.1% field extraction accuracy and sub-100ms processing speed per document."*
- **Action on Screen:**
  - Click **`📊 Accuracy Report`** in the top navbar.
  - The modal pops up showing:
    - **25 / 25 Tests Passing (100%)**
    - **97.1% Extraction Accuracy**
    - **95.0% Validation Accuracy**
    - Sub-100ms average latency
    - Per-field accuracy progress bars
  - Close the modal and conclude your video: *"Thank you! DocuIntellect is production-ready for automated invoice intelligence."*

---

## 🎯 Recording Tips
- **Resolution:** 1080p (1920x1080) works best.
- **Microphone:** Keep microphone volume steady and clear.
- **Mouse Movement:** Smooth, deliberate cursor movements.
