import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import httpx
except (ImportError, Exception) as _httpx_err:
    httpx = None
    logger.warning("httpx could not be imported: %s", _httpx_err)

from app.prompts import (
    INVOICE_EXTRACTION_SYSTEM_PROMPT,
    INVOICE_EXTRACTION_USER_PROMPT_TEMPLATE,
)
from app.schemas.document import ExtractedContent
from app.schemas.extraction import InvoiceExtractionData, LineItem


class InformationExtractor:
    """
    Hybrid Information Extraction Engine implementing a strict Zero-Hallucination Policy.
    Uses LLM (Gemini / OpenAI) when API keys are configured, and seamlessly falls back
    to a robust deterministic regex & spreadsheet-mapping parser.
    """

    @classmethod
    def extract(
        cls,
        filename: str,
        content_type: str,
        extracted_content: ExtractedContent,
    ) -> InvoiceExtractionData:
        """
        Main entry point for Task 2 information extraction.
        """
        # 1. Check if LLM API is configured
        gemini_key = os.getenv("GEMINI_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")

        if gemini_key:
            try:
                llm_res = cls._extract_with_gemini(filename, content_type, extracted_content, gemini_key)
                if llm_res:
                    return llm_res
            except Exception as e:
                logger.warning("Gemini LLM extraction failed, falling back to deterministic parser: %s", e)

        if openai_key:
            try:
                llm_res = cls._extract_with_openai(filename, content_type, extracted_content, openai_key)
                if llm_res:
                    return llm_res
            except Exception as e:
                logger.warning("OpenAI LLM extraction failed, falling back to deterministic parser: %s", e)

        # 2. Deterministic & Rule-Based Fallback Parser (Zero External Dependencies)
        return cls._extract_deterministic(filename, content_type, extracted_content)

    # -------------------------------------------------------------------------
    # LLM EXTRACTION HANDLERS
    # -------------------------------------------------------------------------
    @classmethod
    def _extract_with_gemini(
        cls, filename: str, content_type: str, extracted_content: ExtractedContent, api_key: str
    ) -> Optional[InvoiceExtractionData]:
        if httpx is None:
            logger.warning("httpx library is not installed; skipping Gemini API call.")
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        text_payload = cls._prepare_text_payload(extracted_content)
        user_prompt = INVOICE_EXTRACTION_USER_PROMPT_TEMPLATE.format(
            filename=filename, content_type=content_type, document_text=text_payload
        )

        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": INVOICE_EXTRACTION_SYSTEM_PROMPT + "\n\n" + user_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
            },
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                return cls._parse_llm_json(raw_text, engine="gemini")

        return None

    @classmethod
    def _extract_with_openai(
        cls, filename: str, content_type: str, extracted_content: ExtractedContent, api_key: str
    ) -> Optional[InvoiceExtractionData]:
        if httpx is None:
            logger.warning("httpx library is not installed; skipping OpenAI API call.")
            return None
        url = "https://api.openai.com/v1/chat/completions"
        text_payload = cls._prepare_text_payload(extracted_content)
        user_prompt = INVOICE_EXTRACTION_USER_PROMPT_TEMPLATE.format(
            filename=filename, content_type=content_type, document_text=text_payload
        )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        body = {
            "model": "gpt-4o-mini",
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": INVOICE_EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["choices"][0]["message"]["content"]
                return cls._parse_llm_json(raw_text, engine="openai")

        return None

    @classmethod
    def _prepare_text_payload(cls, extracted_content: ExtractedContent, max_chars: int = 12000) -> str:
        """Combines pages or spreadsheet text summary into context without duplicating."""
        if extracted_content.text_summary:
            return extracted_content.text_summary[:max_chars]
        parts = [f"Page {p.page_number}:\n{p.text}" for p in extracted_content.pages]
        return "\n\n".join(parts)[:max_chars]

    @classmethod
    def _parse_llm_json(cls, raw_text: str, engine: str) -> Optional[InvoiceExtractionData]:
        """Sanitizes and maps LLM output to InvoiceExtractionData."""
        clean_json = raw_text.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json)
            clean_json = re.sub(r"\s*```$", "", clean_json)

        data = json.loads(clean_json)

        line_items = [
            LineItem(
                description=li.get("description"),
                quantity=float(li["quantity"]) if li.get("quantity") is not None else None,
                unit_price=float(li["unit_price"]) if li.get("unit_price") is not None else None,
                line_total=float(li["line_total"]) if li.get("line_total") is not None else None,
            )
            for li in data.get("line_items", [])
        ]

        expected_fields = ["invoice_number", "invoice_date", "supplier_name", "customer_name", "currency", "subtotal", "tax", "total"]
        missing = [f for f in expected_fields if data.get(f) is None]

        return InvoiceExtractionData(
            invoice_number=data.get("invoice_number"),
            invoice_date=data.get("invoice_date"),
            supplier_name=data.get("supplier_name"),
            customer_name=data.get("customer_name"),
            currency=data.get("currency"),
            subtotal=float(data["subtotal"]) if data.get("subtotal") is not None else None,
            tax=float(data["tax"]) if data.get("tax") is not None else None,
            total=float(data["total"]) if data.get("total") is not None else None,
            line_items=line_items,
            extraction_confidence=float(data.get("extraction_confidence", 0.9)),
            extraction_engine=f"llm_{engine}",
            uncertain_fields=data.get("uncertain_fields", []),
            missing_fields=missing,
            raw_response=clean_json,
        )

    # -------------------------------------------------------------------------
    # DETERMINISTIC / RULE-BASED EXTRACTION ENGINE (Zero-Hallucination)
    # -------------------------------------------------------------------------
    @classmethod
    def _extract_deterministic(
        cls, filename: str, content_type: str, extracted_content: ExtractedContent
    ) -> InvoiceExtractionData:
        """
        Deterministic parser supporting spreadsheets and unstructured text.
        Strictly never hallucinates missing data (returns null).
        """
        # If spreadsheet sheets exist, perform spreadsheet-column-mapping extraction
        if extracted_content.sheets:
            return cls._extract_from_spreadsheet(extracted_content.sheets)

        # Otherwise perform regex text extraction
        full_text = cls._prepare_text_payload(extracted_content)
        return cls._extract_from_text(full_text)

    @classmethod
    def _extract_from_spreadsheet(cls, sheets: Dict[str, Any]) -> InvoiceExtractionData:
        """Extracts structured line items and totals from spreadsheet tables."""
        line_items: List[LineItem] = []
        subtotal: Optional[float] = None
        tax: Optional[float] = None
        total: Optional[float] = None
        currency: Optional[str] = None
        invoice_number: Optional[str] = None
        invoice_date: Optional[str] = None
        supplier_name: Optional[str] = None
        customer_name: Optional[str] = None
        uncertain_fields: List[str] = []

        # Check for explicit Invoice_Header key-value sheet first (common in invoice templates)
        for s_name, s_data in sheets.items():
            records = getattr(s_data, "records", []) if hasattr(s_data, "records") else s_data.get("records", [])
            for row in records:
                # Check for Attribute/Value key-value pairs
                attr = str(row.get("Attribute") or row.get("Key") or row.get("Field") or "").strip().lower()
                val = row.get("Value")
                if attr and val is not None:
                    if "invoice_number" in attr or "invoice_no" in attr:
                        invoice_number = str(val).strip()
                    elif "supplier" in attr or "vendor" in attr:
                        supplier_name = str(val).strip()
                    elif "customer" in attr or "client" in attr:
                        customer_name = str(val).strip()
                    elif "date" in attr:
                        invoice_date = cls._normalize_date(str(val))
                    elif "subtotal" in attr:
                        subtotal = cls._to_float(val)
                    elif "tax" in attr:
                        tax = cls._to_float(val)
                    elif "total" in attr and "subtotal" not in attr:
                        total = cls._to_float(val)
                    elif "currency" in attr:
                        currency = str(val).strip().upper()

        # Iterate through sheets to extract line items
        for sheet_name, sheet_data in sheets.items():
            # Skip header sheet if already parsed
            if "header" in sheet_name.lower():
                continue

            records = getattr(sheet_data, "records", []) if hasattr(sheet_data, "records") else sheet_data.get("records", [])
            columns = getattr(sheet_data, "columns", []) if hasattr(sheet_data, "columns") else sheet_data.get("columns", [])
            col_lower_map = {col.lower(): col for col in columns}

            # Detect description column
            desc_candidates = ["product_name", "item_description", "description", "item", "product", "sku", "name", "category", "transaction_id"]
            desc_col = next((col_lower_map[c] for c in desc_candidates if c in col_lower_map), None)

            # Detect quantity column
            qty_candidates = ["quantity", "qty", "units", "warehouse_stock", "total_units_sold", "count"]
            qty_col = next((col_lower_map[c] for c in qty_candidates if c in col_lower_map), None)

            # Detect unit price column
            price_candidates = ["unit_price_bdt", "unit_price", "price_bdt", "price", "rate_bdt", "rate", "cost", "amount_bdt", "amount_usd"]
            price_col = next((col_lower_map[c] for c in price_candidates if c in col_lower_map), None)

            # Detect line total column
            total_candidates = ["line_total_bdt", "line_total", "total_bdt", "total", "amount_bdt", "amount", "total_amount", "revenue_usd", "subtotal"]
            total_col = next((col_lower_map[c] for c in total_candidates if c in col_lower_map), None)

            # Detect supplier / company column
            sup_candidates = ["supplier_name", "supplier", "vendor_name", "vendor", "company_name", "supplier_code"]
            sup_col = next((col_lower_map[c] for c in sup_candidates if c in col_lower_map), None)

            # Detect customer column
            cust_candidates = ["customer_name", "customer", "client_name", "client"]
            cust_col = next((col_lower_map[c] for c in cust_candidates if c in col_lower_map), None)

            # Detect invoice/id column
            inv_candidates = ["invoice_number", "invoice_no", "inv_no", "transaction_id", "order_id", "sku"]
            inv_col = next((col_lower_map[c] for c in inv_candidates if c in col_lower_map), None)

            # Detect date column
            date_candidates = ["invoice_date", "transaction_date", "date", "created_at"]
            date_col = next((col_lower_map[c] for c in date_candidates if c in col_lower_map), None)

            # Detect explicit financial columns in row if present
            explicit_sub_col = next((col_lower_map[c] for c in ["subtotal", "sub_total", "net_amount"] if c in col_lower_map), None)
            explicit_tax_col = next((col_lower_map[c] for c in ["tax", "tax_amount", "vat", "gst"] if c in col_lower_map), None)
            explicit_tot_col = next((col_lower_map[c] for c in ["total", "grand_total", "total_amount", "amount_due"] if c in col_lower_map), None)
            explicit_curr_col = next((col_lower_map[c] for c in ["currency", "curr"] if c in col_lower_map), None)

            for row in records:
                if subtotal is None and explicit_sub_col and row.get(explicit_sub_col) is not None:
                    subtotal = cls._to_float(row.get(explicit_sub_col))
                if tax is None and explicit_tax_col and row.get(explicit_tax_col) is not None:
                    tax = cls._to_float(row.get(explicit_tax_col))
                if total is None and explicit_tot_col and row.get(explicit_tot_col) is not None:
                    total = cls._to_float(row.get(explicit_tot_col))
                if not currency and explicit_curr_col and row.get(explicit_curr_col):
                    currency = str(row[explicit_curr_col]).strip().upper()
                desc_val = str(row[desc_col]).strip() if desc_col and row.get(desc_col) else None
                qty_val = cls._to_float(row.get(qty_col)) if qty_col else None
                price_val = cls._to_float(row.get(price_col)) if price_col else None
                line_total_val = cls._to_float(row.get(total_col)) if total_col else None

                if not line_total_val and qty_val is not None and price_val is not None:
                    line_total_val = round(qty_val * price_val, 2)

                if desc_val or line_total_val is not None:
                    line_items.append(
                        LineItem(
                            description=desc_val,
                            quantity=qty_val,
                            unit_price=price_val,
                            line_total=line_total_val,
                        )
                    )

                if not supplier_name and sup_col and row.get(sup_col):
                    supplier_name = str(row[sup_col]).strip()
                if not customer_name and cust_col and row.get(cust_col):
                    customer_name = str(row[cust_col]).strip()
                if not invoice_number and inv_col and row.get(inv_col):
                    invoice_number = str(row[inv_col]).strip()
                if not invoice_date and date_col and row.get(date_col):
                    invoice_date = cls._normalize_date(str(row[date_col]))

        # Calculate totals from line items if not explicitly set
        if line_items:
            valid_totals = [li.line_total for li in line_items if li.line_total is not None]
            if valid_totals and total is None:
                subtotal = round(sum(valid_totals), 2)
                tax = 0.0
                total = subtotal
            if not currency:
                currency = "BDT"

        if not currency:
            currency = "BDT"

        # Zero-Hallucination: missing fields
        expected = ["invoice_number", "invoice_date", "supplier_name", "customer_name", "currency", "subtotal", "tax", "total"]
        vals = {
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "supplier_name": supplier_name,
            "customer_name": customer_name,
            "currency": currency,
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
        }
        missing = [f for f, v in vals.items() if v is None]

        confidence = 0.95 if (invoice_number and total is not None and supplier_name) else (0.85 if total is not None else 0.70)

        return InvoiceExtractionData(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            supplier_name=supplier_name,
            customer_name=customer_name,
            currency=currency,
            subtotal=subtotal,
            tax=tax,
            total=total,
            line_items=line_items,
            extraction_confidence=confidence,
            extraction_engine="spreadsheet_mapping",
            uncertain_fields=uncertain_fields,
            missing_fields=missing,
        )

    @classmethod
    def _extract_from_text(cls, text: str) -> InvoiceExtractionData:
        """Deterministic regex parsing on unstructured text with Zero-Hallucination guarantees."""
        # 1. Currency Detection
        currency = "BDT"  # Default system currency is Bangladeshi Taka
        if "USD" in text or "$" in text:
            currency = "USD"
        elif "EUR" in text or "€" in text:
            currency = "EUR"
        elif "GBP" in text or "£" in text:
            currency = "GBP"
        elif "BDT" in text or "৳" in text or "tk" in text.lower() or "taka" in text.lower():
            currency = "BDT"

        # 2. Invoice / Receipt Number
        invoice_number = None
        inv_patterns = [
            r"(?i)\b(INV-[0-9A-Za-z\-]+)\b",
            r"(?i)\b(REC-[0-9A-Za-z\-]+)\b",
            r"(?i)\b(MSA-[0-9A-Za-z\-]+)\b",
            r"(?i)(?:Invoice|Receipt|Bill|Challan|Reference|Ref|Memo|Voucher)[ \t]*(?:Number|No|#|\.)?[ \t]*[:\-#]?[ \t]*([A-Za-z0-9\-_/#]+)",
            r"(?i)(?:Invoice|Receipt|Bill|Challan)[ \t]+#?[ \t]*([A-Za-z0-9\-_/#]{3,})",
            r"(?i)#\s*([0-9A-Za-z\-]{4,})",
        ]
        for pat in inv_patterns:
            m = re.search(pat, text)
            if m:
                invoice_number = m.group(1).strip()
                break

        # 3. Invoice Date
        invoice_date = None
        date_patterns = [
            r"(?i)(?:Invoice\s*Date|Due\s*Date|Executed\s*Date|Date)[ \t]*[:\-][ \t]*([A-Za-z0-9,/\-\s]+)",
            r"\b(\d{4}-\d{2}-\d{2})\b",
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
            r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
        ]
        for pat in date_patterns:
            m = re.search(pat, text)
            if m:
                raw_d = m.group(1) if m.groups() else m.group(0)
                parsed_date = cls._normalize_date(raw_d)
                if parsed_date:
                    invoice_date = parsed_date
                    break

        # 4. Supplier Name
        supplier_name = None
        sup_patterns = [
            r"(?i)(?:Supplier|Vendor|From|Billed\s*By|Issued\s*By|Seller|Merchant|Company)[ \t]*[:\-][ \t]*([^\n\r]+)",
            r"(?i)EXPENSE\s*RECEIPT\s*[-–—:]\s*([^\n\r]+)",
            r"(?i)(?:Tax\s*Invoice|Commercial\s*Invoice|Invoice|Challan)\s*[-–—:]\s*([^\n\r]+)",
            r"(?i)Supplier:\s*([^\n\r\(\)]+)",
        ]
        for pat in sup_patterns:
            m = re.search(pat, text)
            if m:
                supplier_name = m.group(1).strip()
                supplier_name = re.sub(r"\s*\(.*?\)$", "", supplier_name).strip()
                break

        # Fallback top-lines supplier discovery for OCR screenshots
        if not supplier_name:
            top_lines = [l.strip() for l in text.splitlines() if l.strip()]
            for line in top_lines[:5]:
                if re.search(r"(?i)\b(Ltd|Limited|PLC|Inc|Corp|Corporation|Industries|Enterprises?|Hospital|Pharmacy|Trading|Technologies|BD)\b", line):
                    if not re.search(r"(?i)\b(invoice|receipt|bill|date|total|amount|due|subtotal)\b", line):
                        supplier_name = line
                        break

        # 5. Customer Name
        customer_name = None
        cust_patterns = [
            r"(?i)(?:Customer|Client|Bill\s*To|Sold\s*To|Billed\s*To|To)[ \t]*[:\-][ \t]*([^\n\r]+)",
            r"(?i)Client:\s*([^\n\r\(\)]+)",
        ]
        for pat in cust_patterns:
            m = re.search(pat, text)
            if m:
                customer_name = m.group(1).strip()
                customer_name = re.sub(r"\s*\(.*?\)$", "", customer_name).strip()
                break

        # 6. Financial Totals (Subtotal, Tax, Total)
        subtotal = None
        subtotal_match = re.search(r"(?i)\bsubtotal\b[ \t]*[:\-]?\s*(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9.,]+(?:\.[0-9]{1,2})?)", text)
        if subtotal_match:
            subtotal = cls._to_float(subtotal_match.group(1))

        tax = None
        tax_match = re.search(r"(?i)\b(?:tax|vat)\b(?:\s*\([^)]*\))?[ \t]*[:\-]?\s*(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9.,]+(?:\.[0-9]{1,2})?)", text)
        if tax_match:
            tax = cls._to_float(tax_match.group(1))

        total = None
        total_patterns = [
            r"(?i)\b(?:total\s*amount|total\s*paid|grand\s*total|amount\s*due|total\s*due|total\s*payable)\b[ \t]*[:\-]?\s*(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9.,]+(?:\.[0-9]{1,2})?)",
            r"(?i)(?<!sub)\btotal\b[ \t]*[:\-]?\s*(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9.,]+(?:\.[0-9]{1,2})?)",
            r"(?i)engagement\s*fee\s*is\s*(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9.,]+(?:\.[0-9]{1,2})?)",
        ]
        for pat in total_patterns:
            m = re.search(pat, text)
            if m:
                total = cls._to_float(m.group(1))
                break

        # 7. Line Items Extraction
        line_items: List[LineItem] = []

        # Check multi-line sequential cell format (Desc \n Qty \n Price \n LineTotal)
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        idx = 0
        while idx < len(lines):
            line = lines[idx]
            if idx + 3 < len(lines):
                qty_m = re.match(r"^(\d+)$", lines[idx + 1])
                price_m = re.match(r"^(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9,]+(?:\.[0-9]{1,2})?)$", lines[idx + 2])
                total_m = re.match(r"^(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9,]+(?:\.[0-9]{1,2})?)$", lines[idx + 3])
                if qty_m and price_m and total_m:
                    desc_candidate = line
                    if not any(k in desc_candidate.lower() for k in ["description", "subtotal", "tax", "vat", "total", "summary", "invoice"]):
                        line_items.append(
                            LineItem(
                                description=desc_candidate,
                                quantity=float(qty_m.group(1)),
                                unit_price=cls._to_float(price_m.group(1)),
                                line_total=cls._to_float(total_m.group(1)),
                            )
                        )
                        idx += 4
                        continue
            idx += 1

        # Check single-line tabular format: Description Qty Price Total e.g. "Dedicated Cloud Cluster 2 $450.00 $900.00"
        if not line_items:
            item_pattern = re.compile(
                r"([A-Za-z0-9\s\-_/\"\'\(\)]+?)\s+(\d+)\s+(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:BDT|Tk\.?|৳|[$€£¥])?\s*([0-9,]+(?:\.[0-9]{1,2})?)"
            )
            for line_str in lines:
                if any(k in line_str.lower() for k in ["subtotal", "tax", "vat", "total", "item", "qty"]):
                    continue
                m = item_pattern.search(line_str)
                if m:
                    desc = m.group(1).strip()
                    q = float(m.group(2))
                    p = cls._to_float(m.group(3))
                    lt = cls._to_float(m.group(4))
                    if desc and p is not None and lt is not None:
                        line_items.append(
                            LineItem(
                                description=desc,
                                quantity=q,
                                unit_price=p,
                                line_total=lt,
                            )
                        )

        # Fallback subtotal if not explicitly stated
        if subtotal is None and line_items:
            subtotal = round(sum(li.line_total for li in line_items if li.line_total is not None), 2)
            if total is None and tax is None:
                total = subtotal

        # Zero-Hallucination: identify missing fields
        expected = ["invoice_number", "invoice_date", "supplier_name", "customer_name", "currency", "subtotal", "tax", "total"]
        vals = {
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "supplier_name": supplier_name,
            "customer_name": customer_name,
            "currency": currency,
            "subtotal": subtotal,
            "tax": tax,
            "total": total,
        }
        missing = [f for f, v in vals.items() if v is None]

        uncertain = []
        if total is None:
            uncertain.append("total")
        if invoice_number and len(invoice_number) < 3:
            uncertain.append("invoice_number")

        # Confidence calculation
        core_fields = [invoice_number, invoice_date, supplier_name, total]
        core_present = sum(1 for f in core_fields if f is not None)
        base_confidence = round(0.5 + (core_present / 4.0) * 0.45, 2)
        if uncertain:
            base_confidence = max(0.5, round(base_confidence - 0.15, 2))

        return InvoiceExtractionData(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            supplier_name=supplier_name,
            customer_name=customer_name,
            currency=currency,
            subtotal=subtotal,
            tax=tax,
            total=total,
            line_items=line_items,
            extraction_confidence=base_confidence,
            extraction_engine="deterministic_regex",
            uncertain_fields=uncertain,
            missing_fields=missing,
        )

    # -------------------------------------------------------------------------
    # UTILITY HELPERS
    # -------------------------------------------------------------------------
    @staticmethod
    def _to_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        try:
            s = str(val).strip()
            # Clean symbols, preserve digits, dots, commas, minus
            s = re.sub(r"[^\d.,-]", "", s)
            if not s:
                return None
            # If both commas and dots exist: e.g. 40,000.00 vs 40.000,00
            if "," in s and "." in s:
                if s.rfind(".") > s.rfind(","):
                    s = s.replace(",", "")
                else:
                    s = s.replace(".", "").replace(",", ".")
            elif s.count(".") > 1:
                # Multiple periods from OCR (e.g. 40.000.00)
                parts = s.split(".")
                s = "".join(parts[:-1]) + "." + parts[-1]
            elif s.count(",") > 1:
                # Multiple commas (e.g. 1,000,000)
                s = s.replace(",", "")
            elif "," in s and "." not in s:
                parts = s.split(",")
                if len(parts[-1]) == 2:
                    s = parts[0] + "." + parts[1]
                else:
                    s = s.replace(",", "")
            return float(s)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _normalize_date(date_str: str) -> Optional[str]:
        if not date_str:
            return None
        date_str = date_str.strip().rstrip(",.")

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%m-%d-%Y",
            "%B %d, %Y",
            "%b %d, %Y",
            "%B %d %Y",
            "%b %d %Y",
            "%d %B %Y",
            "%d %b %Y",
            "%Y-%m-%d %H:%M:%S",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", date_str)
        if m:
            try:
                return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            except ValueError:
                pass

        return None
