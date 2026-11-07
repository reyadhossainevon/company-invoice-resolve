import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  FileImage,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Calendar,
  Building,
  User,
  Hash,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { DocumentResponse } from '../types/document';
import { SpreadsheetViewer } from './SpreadsheetViewer';

interface InspectionModalProps {
  document: DocumentResponse | null;
  onClose: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({ document, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ai_data' | 'validation' | 'raw_content' | 'json'>('ai_data');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  if (!document) return null;

  const { filename, status, file_size, metadata, extracted_content, extraction_data, validation_result, error_details } = document;
  const pages = extracted_content?.pages || [];
  const sheets = extracted_content?.sheets || {};
  const hasPages = pages.length > 0;
  const hasSheets = Object.keys(sheets).length > 0;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPage = pages[activePageIndex] || pages[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
              {hasSheets ? (
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              ) : hasPages ? (
                <FileText className="h-5 w-5 text-blue-400" />
              ) : (
                <FileImage className="h-5 w-5 text-cyan-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white truncate max-w-sm sm:max-w-lg" title={filename}>
                  {filename}
                </h3>
                {status === 'processed' ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Ingested
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Failed
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                <span>{formatFileSize(file_size)}</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>{metadata.processing_time_ms.toFixed(1)} ms</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-400 uppercase font-mono text-[10px]">
                  {metadata.extraction_method}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation: 3 Core Tabs + JSON */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-800 bg-slate-900/60">
          <div className="flex space-x-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ai_data')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'ai_data'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Extracted AI Data (Task 2)</span>
            </button>

            <button
              onClick={() => setActiveTab('validation')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'validation'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Validation & Math (Task 3)</span>
              {validation_result?.errors_count ? (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px]">
                  {validation_result.errors_count}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab('raw_content')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === 'raw_content'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Raw Content (Task 1)</span>
            </button>

            <button
              onClick={() => setActiveTab('json')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'json'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Master Schema (JSON)
            </button>
          </div>

          <button
            onClick={() => copyToClipboard(JSON.stringify(document, null, 2))}
            className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer mb-2"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Failure Alert if file failed */}
          {status === 'failed' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Error Code: {error_details?.error_code || 'UNSPECIFIED_FAILURE'}</span>
              </div>
              <p className="text-xs text-slate-300 pl-6 leading-relaxed">
                {error_details?.error_reason || 'Document processing could not decode the provided stream.'}
              </p>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 1: EXTRACTED AI DATA (TASK 2)                             */}
          {/* ============================================================= */}
          {activeTab === 'ai_data' && status === 'processed' && extraction_data && (
            <div className="space-y-6">
              {/* Extraction Meta Banner */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Engine: {extraction_data.extraction_engine}</span>
                  </div>
                  <span className="text-slate-400">
                    Policy: <strong className="text-slate-200">Strict Zero-Hallucination</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Extraction Confidence:</span>
                  <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        extraction_data.extraction_confidence >= 0.8
                          ? 'bg-emerald-400'
                          : extraction_data.extraction_confidence >= 0.6
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.round(extraction_data.extraction_confidence * 100)}%` }}
                    />
                  </div>
                  <span className="font-bold font-mono text-slate-200">
                    {Math.round(extraction_data.extraction_confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Core Header Fields Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Invoice Number */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                    <Hash className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Invoice Number</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-white truncate" title={extraction_data.invoice_number || 'null'}>
                    {extraction_data.invoice_number || <span className="text-slate-500 italic font-normal">null (not found)</span>}
                  </div>
                </div>

                {/* Invoice Date */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Invoice Date</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-white truncate" title={extraction_data.invoice_date || 'null'}>
                    {extraction_data.invoice_date || <span className="text-slate-500 italic font-normal">null (not found)</span>}
                  </div>
                </div>

                {/* Supplier */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                    <Building className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Supplier / Vendor</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate" title={extraction_data.supplier_name || 'null'}>
                    {extraction_data.supplier_name || <span className="text-slate-500 italic font-normal">null (not found)</span>}
                  </div>
                </div>

                {/* Customer */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Customer / Client</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate" title={extraction_data.customer_name || 'null'}>
                    {extraction_data.customer_name || <span className="text-slate-500 italic font-normal">null (not found)</span>}
                  </div>
                </div>
              </div>

              {/* Financial Totals Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400">Subtotal</span>
                  <div className="mt-1 text-xl font-bold font-mono text-white">
                    {extraction_data.subtotal !== null ? (
                      `${extraction_data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${extraction_data.currency || ''}`
                    ) : (
                      <span className="text-slate-500 text-sm italic font-normal">null</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400">Tax</span>
                  <div className="mt-1 text-xl font-bold font-mono text-white">
                    {extraction_data.tax !== null ? (
                      `${extraction_data.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${extraction_data.currency || ''}`
                    ) : (
                      <span className="text-slate-500 text-sm italic font-normal">null</span>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-950/60 to-slate-950 border border-indigo-500/30 rounded-xl p-4">
                  <span className="text-xs text-indigo-300 font-semibold">Grand Total</span>
                  <div className="mt-1 text-2xl font-bold font-mono text-emerald-400">
                    {extraction_data.total !== null ? (
                      `${extraction_data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${extraction_data.currency || ''}`
                    ) : (
                      <span className="text-slate-500 text-sm italic font-normal">null</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    Extracted Line Items ({extraction_data.line_items.length})
                  </span>
                  <span>Currency: {extraction_data.currency || 'USD'}</span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  {extraction_data.line_items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No tabular line items detected in document.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="py-2 px-3 w-8 text-center font-mono">#</th>
                          <th className="py-2 px-3">Item Description</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300 font-mono">
                        {extraction_data.line_items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-center text-slate-500 text-[10px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-sans text-white">{item.description || '—'}</td>
                            <td className="py-2 px-3 text-right">{item.quantity !== null ? item.quantity : '—'}</td>
                            <td className="py-2 px-3 text-right">
                              {item.unit_price !== null ? item.unit_price.toFixed(2) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-200">
                              {item.line_total !== null ? item.line_total.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Zero-Hallucination Disclosures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Missing Fields */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Missing Fields (Set to null under Zero-Hallucination policy):
                  </span>
                  {extraction_data.missing_fields.length === 0 ? (
                    <span className="text-xs text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>None (All expected fields present)</span>
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {extraction_data.missing_fields.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Uncertain Fields */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Uncertain / Ambiguous Fields:
                  </span>
                  {extraction_data.uncertain_fields.length === 0 ? (
                    <span className="text-xs text-slate-400">None detected</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {extraction_data.uncertain_fields.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: VALIDATION & MATH CHECK (TASK 3)                       */}
          {/* ============================================================= */}
          {activeTab === 'validation' && status === 'processed' && validation_result && (
            <div className="space-y-6">
              {/* Overall Validation Status Banner */}
              {validation_result.validation_status === 'valid' ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">Validation Passed (Ready for Ledger Sync)</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      All mathematical equations balance, critical fields are populated, and no duplicate records were found.
                    </p>
                  </div>
                </div>
              ) : validation_result.duplicate_info ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3">
                  <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-300">Duplicate Invoice Flagged (Action Required)</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Matches previously registered invoice in system. Requires reconciliation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">Flagged for Manual Review</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      One or more automated validation checks flagged discrepancies. Review rule results below.
                    </p>
                  </div>
                </div>
              )}

              {/* Duplicate Details Box (if duplicate) */}
              {validation_result.duplicate_info && (
                <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                    <Copy className="h-4 w-4" />
                    <span>Duplicate Invoice Match Details</span>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Matched Filename:</span>{' '}
                      <strong className="text-white">{validation_result.duplicate_info.matched_filename}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Matched Document ID:</span>{' '}
                      <span className="text-slate-300 font-mono text-[10px]">{validation_result.duplicate_info.matched_doc_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Invoice Number:</span>{' '}
                      <strong className="text-white">{validation_result.duplicate_info.invoice_number || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Registered Timestamp:</span>{' '}
                      <span className="text-slate-300">{validation_result.duplicate_info.registered_at}</span>
                    </div>
                  </dl>
                </div>
              )}

              {/* Validation Rules Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    Automated Rule Results ({validation_result.rule_results.length})
                  </span>
                  <span>
                    {validation_result.passed_count} Passed • {validation_result.errors_count} Failed • {validation_result.warnings_count} Warnings
                  </span>
                </div>

                <div className="space-y-2.5">
                  {validation_result.rule_results.map((rule) => {
                    const isPassed = rule.status === 'passed';
                    const isFailed = rule.status === 'failed';

                    return (
                      <div
                        key={rule.rule_id}
                        className={`rounded-xl p-3.5 border transition-colors ${
                          isPassed
                            ? 'bg-slate-950/60 border-slate-800'
                            : isFailed
                            ? 'bg-rose-950/20 border-rose-500/30'
                            : 'bg-amber-950/20 border-amber-500/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            {isPassed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : isFailed ? (
                              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                            ) : (
                              <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-white">{rule.rule_name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
                              {rule.category}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto ${
                              isPassed
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isFailed
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {rule.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-2 pl-6 leading-relaxed">
                          {rule.message}
                        </p>

                        {/* Side-by-side Expected vs Actual Callout */}
                        {rule.expected && rule.actual && isFailed && (
                          <div className="mt-2.5 ml-6 flex flex-wrap items-center gap-3 text-xs font-mono">
                            <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400">Expected:</span>{' '}
                              <strong className="text-emerald-400">{rule.expected}</strong>
                            </div>
                            <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400">Actual:</span>{' '}
                              <strong className="text-rose-400">{rule.actual}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: RAW DOCUMENT CONTENT (TASK 1)                          */}
          {/* ============================================================= */}
          {activeTab === 'raw_content' && status === 'processed' && (
            <div className="space-y-4">
              {/* Spreadsheets View */}
              {hasSheets && <SpreadsheetViewer sheets={sheets} />}

              {/* Pages View (PDFs & Images) */}
              {hasPages && (
                <div className="space-y-4">
                  {pages.length > 1 && (
                    <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                      <span className="text-xs text-slate-400 font-medium shrink-0">Select Page:</span>
                      {pages.map((p, idx) => {
                        const isActive = idx === activePageIndex;
                        return (
                          <button
                            key={p.page_number}
                            onClick={() => setActivePageIndex(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Page {p.page_number}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentPage && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold text-white">
                          Page {currentPage.page_number} of {pages.length}
                        </span>
                        <span className="text-slate-400">
                          Method:{' '}
                          <span className="text-indigo-400 font-medium uppercase font-mono text-[10px]">
                            {currentPage.method}
                          </span>
                        </span>
                        <span className="text-slate-400">
                          Characters: <strong className="text-white">{currentPage.char_count}</strong>
                        </span>
                      </div>

                      {currentPage.image_preprocessing && (
                        <div className="flex items-center space-x-2">
                          <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="text-slate-400 text-[11px]">
                            Deskew ({currentPage.image_preprocessing.deskew_angle || 0}°), Adaptive Threshold
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {currentPage && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[220px] max-h-[380px] overflow-y-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                      {currentPage.text || <span className="text-slate-500 italic">No text extracted on this page.</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4: MASTER JSON SCHEMA (TASK 1 + 2 + 3)                    */}
          {/* ============================================================= */}
          {activeTab === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Unified Standardized Production JSON Payload (Tasks 1, 2, 3)</span>
                <span>{formatFileSize(JSON.stringify(document).length)}</span>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400/90 max-h-[460px] overflow-auto leading-relaxed select-text">
                {JSON.stringify(document, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            DocuIntellect Intelligence Engine • Zero-Hallucination & Math Verification Active
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
