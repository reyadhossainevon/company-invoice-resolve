# AI Prompts & AI-Assisted Development Disclosure
### DocuIntellect • AI-Powered Document Intelligence & Verification System

This document provides transparent documentation of the prompts, extraction schemas, deterministic fallback heuristics, and the AI-assisted engineering methodology used to build DocuIntellect.

---

## 1. Zero-Hallucination AI Information Extraction Prompts

### Design Philosophy
Enterprise financial systems require strict adherence to factuality. Hallucinations—such as assuming a missing invoice date, guessing an unstated tax rate, or extrapolating supplier addresses—lead to compliance and accounting failures. DocuIntellect enforces a **Zero-Hallucination Policy**:
1. Fields not explicitly and unambiguously present in the source text must evaluate to `null`.
2. Any field assigned `null` must be logged in `missing_fields`.
3. Low-confidence or ambiguous values must be logged in `uncertain_fields`.
4. Outputs must strictly conform to a validated JSON schema without conversational markdown wrapping.

---

### System Prompt (Production Template)
Defined in [`backend/app/prompts.py`](file:///c:/Projects/new-project/backend/app/prompts.py):

```text
You are a specialized enterprise AI Document Intelligence Extraction Engine for financial documents, invoices, receipts, and purchase orders.

### ZERO-HALLUCINATION POLICY:
1. ONLY extract information that is explicitly stated in the provided document text or tabular data.
2. If any field is NOT explicitly mentioned or cannot be unambiguously determined, you MUST set its value to `null`.
3. NEVER assume, guess, extrapolate, or invent values (e.g., do not invent an invoice number, date, tax rate, or supplier name).
4. For all fields set to `null`, list the field name in the `missing_fields` array.
5. If a field's value is blurry, conflicting, or uncertain, extract the best candidate and list the field name in `uncertain_fields`.

### OUTPUT FORMAT:
You must output a single, raw, valid JSON object matching the exact schema below without markdown formatting or surrounding explanations:

{
  "invoice_number": string or null,
  "invoice_date": string (ISO 8601 "YYYY-MM-DD") or null,
  "supplier_name": string or null,
  "customer_name": string or null,
  "currency": string (3-letter ISO code e.g. "USD", "EUR", "GBP", "BDT", "CAD") or null,
  "subtotal": float or null,
  "tax": float or null,
  "total": float or null,
  "line_items": [
    {
      "description": string or null,
      "quantity": float or null,
      "unit_price": float or null,
      "line_total": float or null
    }
  ],
  "extraction_confidence": float between 0.0 and 1.0,
  "uncertain_fields": [string],
  "missing_fields": [string]
}

### NORMALIZATION RULES:
- Date: Convert all valid date formats ("Jan 15, 2026", "15/01/2026", "01-15-2026") into ISO 8601 "YYYY-MM-DD". If invalid or missing, return `null`.
- Currency: Map currency symbols to 3-letter codes ("$" -> "USD", "€" -> "EUR", "£" -> "GBP", "৳" -> "BDT", "¥" -> "JPY").
- Numeric Fields: Remove currency symbols and commas (e.g., "$1,250.50" -> 1250.50). Must be valid numbers or null.
- Line Items: Extract each individual product or service item. If a sub-value (quantity or unit price) is not listed, set it to null.
```

---

### User Prompt Template
```text
Extract structured invoice data from the following document content according to the strict Zero-Hallucination rules:

--- DOCUMENT METADATA ---
Filename: {filename}
File Type: {content_type}

--- DOCUMENT EXTRACTED CONTENT ---
{document_text}

---
Remember: Output ONLY valid JSON matching the schema. Never invent missing data.
```

---

## 2. Deterministic Fallback Heuristics & Regex Rules

To guarantee that the application functions 100% offline out-of-the-box—even without an active Gemini or OpenAI API key or when API quotas are exceeded—DocuIntellect includes a comprehensive deterministic extraction engine ([`extractor.py`](file:///c:/Projects/new-project/backend/app/services/extractor.py)):

### Regex Heuristics:
1. **Invoice Number Detection:**
   - Patterns: `(?:invoice|inv|bill|receipt|po|order)[#\s.:\-]*([A-Z0-9\-_]{3,25})`
   - Strict boundaries preventing capture of generic words like "DATE" or "TAX".
2. **Date Extraction & ISO Normalization:**
   - ISO: `\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b`
   - US / European: `\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b`
   - Written Month: `\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b`
   - Normalized cleanly to standard `YYYY-MM-DD`.
3. **Financial Amounts Extraction:**
   - Total Amount: Negative lookbehind `(?<!sub)\b(?:total|grand\s*total|amount\s*due)\b[:\s]*[\$€£৳¥]?\s*([0-9,]+\.[0-9]{2})`
   - Subtotal: `\b(?:sub\s*total|subtotal|net\s*amount)\b[:\s]*[\$€£৳¥]?\s*([0-9,]+\.[0-9]{2})`
   - Tax / VAT: `\b(?:tax|vat|gst|sales\s*tax)\b[^0-9\n]*[\$€£৳¥]?\s*([0-9,]+\.[0-9]{2})`
4. **Spreadsheet Column Mapping:**
   - Multi-sheet headers: scans for `Invoice_Header` key-value pairs (`Attribute`/`Value`).
   - Line items: dynamically detects description (`product_name`, `item_description`, `description`), quantity (`qty`, `units`, `quantity`), unit price (`unit_price`, `price`, `rate`), and line totals (`line_total`, `total`, `amount`).

---

## 3. AI-Assisted Development Disclosure

In accordance with academic and engineering integrity standards, this section discloses how AI tools were utilized during the development of DocuIntellect:

### 1. Architectural Guidance & Pair Programming
- **Tool Used:** Antigravity (Advanced Agentic AI Assistant, Google DeepMind).
- **Scope:** Pair-programming partner for exploring modular design patterns, drafting Pydantic data models, configuring FastAPI REST route hierarchies, and designing SQLite relational schemas via SQLAlchemy.

### 2. Code Generation & Optimization
- **Document Processing Pipelines:** AI assistance was used to implement OpenCV affine transformation algorithms for deskewing images via `cv2.minAreaRect` and adaptive Gaussian thresholding.
- **Streaming Handlers:** PyMuPDF streaming page-by-page generator routines were designed to scale up to 1000 pages with minimal memory footprints.
- **Frontend Components:** React 19 + TypeScript + Tailwind CSS UI components (Split-screen workspace, interactive line-item editors, and metrics modals) were authored and refined with agentic code generation.

### 3. Test Suite Synthesis & Edge Case Modeling
- Automated sample generators ([`generate_samples.py`](file:///c:/Projects/new-project/backend/sample_data/generate_samples.py)) were constructed with synthetic ground-truth values to rigorously test edge cases:
  - Valid digital PDFs vs noisy scanned OCR receipts
  - Math mismatches (`Subtotal + Tax != Total`)
  - Arithmetic line-item calculation errors (`Qty * Price != Line Total`)
  - Missing vendor headers in CSV files
  - Duplicate detection composite key matching
  - Corrupted byte streams and empty 0-byte headers

### 4. Human Review & Verification
- All generated code was compiled, linted, and verified through an automated 25-test `pytest` suite and measured evaluation benchmarks before delivery.
- All algorithms maintain documentation integrity, zero-hallucination compliance, and robust error isolation.
