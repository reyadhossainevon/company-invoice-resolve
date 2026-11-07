export type DocumentStatus = 'processed' | 'failed' | 'pending' | 'processing';

export type ExtractionMethod =
  | 'digital_pdf'
  | 'ocr'
  | 'hybrid_pdf'
  | 'spreadsheet_parser'
  | 'none';

export interface PageContent {
  page_number: number;
  text: string;
  char_count: number;
  method: ExtractionMethod;
  ocr_confidence: number | null;
  image_preprocessing?: {
    original_width?: number;
    original_height?: number;
    grayscale_applied?: boolean;
    denoising_applied?: boolean;
    deskew_angle?: number;
    adaptive_threshold_applied?: boolean;
    [key: string]: any;
  } | null;
}

export interface SheetData {
  sheet_name: string;
  columns: string[];
  row_count: number;
  column_count: number;
  records: Record<string, any>[];
}

export interface DocumentMetadata {
  page_count: number;
  sheet_names: string[];
  file_size_bytes: number;
  processing_time_ms: number;
  extraction_method: ExtractionMethod;
  content_type: string;
  extra_details?: Record<string, any>;
}

export interface ExtractedContent {
  pages: PageContent[];
  sheets: Record<string, SheetData>;
  text_summary: string;
}

export interface ErrorDetails {
  error_code: string;
  error_reason: string;
  stack_trace?: string;
}

// ----------------------------------------------------------------------------
// TASK 2: AI INFORMATION EXTRACTION SCHEMAS
// ----------------------------------------------------------------------------
export interface LineItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
}

export interface InvoiceExtractionData {
  invoice_number: string | null;
  invoice_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  line_items: LineItem[];
  extraction_confidence: number;
  extraction_engine: string;
  uncertain_fields: string[];
  missing_fields: string[];
  raw_response?: string | null;
}

// ----------------------------------------------------------------------------
// TASK 3: DATA VALIDATION SCHEMAS
// ----------------------------------------------------------------------------
export type ValidationRuleStatus = 'passed' | 'failed' | 'warning';
export type ValidationStatus = 'valid' | 'needs_review' | 'invalid';

export interface ValidationRuleResult {
  rule_id: string;
  rule_name: string;
  category: string;
  status: ValidationRuleStatus;
  message: string;
  expected?: string | null;
  actual?: string | null;
}

export interface DocumentValidationResult {
  validation_status: ValidationStatus;
  requires_manual_review: boolean;
  confidence_score: number;
  rule_results: ValidationRuleResult[];
  errors_count: number;
  warnings_count: number;
  passed_count: number;
  duplicate_info?: {
    type?: string;
    matched_doc_id?: string;
    matched_filename?: string;
    invoice_number?: string;
    supplier_name?: string;
    registered_at?: string;
    [key: string]: any;
  } | null;
}

export interface HistoryLogEntry {
  id?: number;
  action: string;
  details: string;
  timestamp: string;
}

export interface InvoiceCorrectionPayload {
  invoice_number?: string | null;
  invoice_date?: string | null;
  supplier_name?: string | null;
  customer_name?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  line_items?: LineItem[];
  edit_note?: string;
}

// ----------------------------------------------------------------------------
// UNIFIED MASTER RESPONSE
// ----------------------------------------------------------------------------
export interface DocumentResponse {
  file_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: 'processed' | 'failed' | 'queued' | 'processing';
  metadata: DocumentMetadata;
  extracted_content: ExtractedContent | null;
  extraction_data?: InvoiceExtractionData | null;      // Task 2
  validation_result?: DocumentValidationResult | null; // Task 3
  error_details: ErrorDetails | null;
  history_logs?: HistoryLogEntry[];
  relevance_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BatchUploadResponse {
  total_files: number;
  successful_count: number;
  failed_count: number;
  processing_time_total_ms: number;
  documents: DocumentResponse[];
}

export interface SystemHealth {
  status: string;
  service: string;
  tesseract_ocr: {
    available: boolean;
    configured_path: string;
  };
  supported_extensions: string[];
  max_file_size_mb: number;
}
