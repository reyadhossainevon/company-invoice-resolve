import React, { useEffect, useState } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  AlertOctagon,
  Hash,
  Calendar,
  Building,
  User,
  Edit3,
  RefreshCw,
  Plus,
  Trash2,
  History,
  Save,
  X,
  Calculator,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { DocumentResponse, LineItem } from '../types/document';
import { SpreadsheetViewer } from './SpreadsheetViewer';
import { correctDocument, reprocessDocument } from '../services/api';
import { formatBDT, formatFileSize } from '../utils/formatters';

interface DocumentDetailPanelProps {
  document: DocumentResponse | null;
  onDocumentUpdated?: (updated: DocumentResponse) => void;
  onDeleteDocument?: (fileId: string) => void;
}

export const DocumentDetailPanel: React.FC<DocumentDetailPanelProps> = ({
  document,
  onDocumentUpdated,
  onDeleteDocument,
}) => {
  const [viewMode, setViewMode] = useState<'invoice' | 'raw' | 'history'>('invoice');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Editing state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Edit form state
  const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>('');
  const [editInvoiceDate, setEditInvoiceDate] = useState<string>('');
  const [editSupplierName, setEditSupplierName] = useState<string>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCurrency, setEditCurrency] = useState<string>('BDT');
  const [editSubtotal, setEditSubtotal] = useState<string>('');
  const [editTax, setEditTax] = useState<string>('');
  const [editTotal, setEditTotal] = useState<string>('');
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editNote, setEditNote] = useState<string>('');

  // Sync form state when document changes
  useEffect(() => {
    setIsEditing(false);
    setActionSuccessMessage(null);
    if (document?.extraction_data) {
      const ext = document.extraction_data;
      setEditInvoiceNumber(ext.invoice_number || '');
      setEditInvoiceDate(ext.invoice_date || '');
      setEditSupplierName(ext.supplier_name || '');
      setEditCustomerName(ext.customer_name || '');
      setEditCurrency(ext.currency || 'BDT');
      setEditSubtotal(ext.subtotal !== null && ext.subtotal !== undefined ? String(ext.subtotal) : '');
      setEditTax(ext.tax !== null && ext.tax !== undefined ? String(ext.tax) : '');
      setEditTotal(ext.total !== null && ext.total !== undefined ? String(ext.total) : '');
      setEditLineItems(ext.line_items || []);
    } else {
      setEditInvoiceNumber('');
      setEditInvoiceDate('');
      setEditSupplierName('');
      setEditCustomerName('');
      setEditCurrency('BDT');
      setEditSubtotal('');
      setEditTax('');
      setEditTotal('');
      setEditLineItems([]);
    }
    setEditNote('');
  }, [document?.file_id]);

  if (!document) {
    return (
      <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <FileText className="h-16 w-16 text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No Document Selected</h3>
        <p className="text-base text-slate-500 mt-1 max-w-sm">
          Select an invoice from the left list to inspect extracted fields, or click "Load Demo Invoices (BDT)".
        </p>
      </div>
    );
  }

  const {
    filename,
    status,
    file_size,
    metadata,
    extraction_data,
    validation_result,
    error_details,
    extracted_content,
    history_logs = [],
  } = document;
  const pages = extracted_content?.pages || [];
  const sheets = extracted_content?.sheets || {};
  const hasPages = pages.length > 0;
  const hasSheets = Object.keys(sheets).length > 0;
  const currentPage = pages[activePageIndex] || pages[0];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Line item editing helpers
  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    setEditLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? parseFloat(value) : item.quantity;
        const price = field === 'unit_price' ? parseFloat(value) : item.unit_price;
        if (!isNaN(qty as number) && !isNaN(price as number) && qty !== null && price !== null) {
          item.line_total = Math.round(Number(qty) * Number(price) * 100) / 100;
        }
      }

      next[index] = item;
      return next;
    });
  };

  const handleAddLineItem = () => {
    setEditLineItems((prev) => [
      ...prev,
      { description: 'New Item', quantity: 1, unit_price: 0, line_total: 0 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setEditLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoSumLineItems = () => {
    const sum = editLineItems.reduce((acc, curr) => acc + (curr.line_total || 0), 0);
    const roundedSubtotal = Math.round(sum * 100) / 100;
    setEditSubtotal(String(roundedSubtotal));

    const taxVal = parseFloat(editTax) || 0;
    const roundedTotal = Math.round((roundedSubtotal + taxVal) * 100) / 100;
    setEditTotal(String(roundedTotal));
  };

  // Save manual edit corrections
  const handleSaveCorrection = async () => {
    if (!document) return;
    setIsSaving(true);
    try {
      const payload = {
        invoice_number: editInvoiceNumber.trim() || null,
        invoice_date: editInvoiceDate.trim() || null,
        supplier_name: editSupplierName.trim() || null,
        customer_name: editCustomerName.trim() || null,
        currency: editCurrency.trim() || 'BDT',
        subtotal: editSubtotal !== '' ? parseFloat(editSubtotal) : null,
        tax: editTax !== '' ? parseFloat(editTax) : null,
        total: editTotal !== '' ? parseFloat(editTotal) : null,
        line_items: editLineItems,
        edit_note: editNote.trim() || 'Manual corrections applied in BDT',
      };

      const updated = await correctDocument(document.file_id, payload);
      setIsEditing(false);
      setActionSuccessMessage('Corrections saved! Validation Engine re-checked calculations.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
      if (onDocumentUpdated) {
        onDocumentUpdated(updated);
      }
    } catch (err) {
      alert(`Failed to save correction: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reprocess document pipeline
  const handleReprocess = async () => {
    if (!document) return;
    setIsReprocessing(true);
    try {
      const reprocessed = await reprocessDocument(document.file_id);
      setActionSuccessMessage('Document reprocessed from original file.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
      if (onDocumentUpdated) {
        onDocumentUpdated(reprocessed);
      }
    } catch (err) {
      alert(`Failed to reprocess: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    if (!window.confirm(`Are you sure you want to delete "${document.filename}"?`)) return;
    setIsDeleting(true);
    try {
      if (onDeleteDocument) {
        await onDeleteDocument(document.file_id);
      }
    } catch (err) {
      alert(`Failed to delete document: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Find failed rules for plain English warning alert
  const failedRules = validation_result?.rule_results.filter((r) => r.status === 'failed') || [];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
        <div className="min-w-0">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-extrabold text-slate-900 truncate max-w-sm sm:max-w-md" title={filename}>
              {filename}
            </h3>
            {status === 'processed' ? (
              <span className="text-sm font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md border border-emerald-300">
                Ready ({metadata.processing_time_ms.toFixed(0)}ms)
              </span>
            ) : (
              <span className="text-sm font-bold text-rose-800 bg-rose-100 px-3 py-1 rounded-md border border-rose-300">
                Failed
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-500 mt-1">
            <span>{formatFileSize(file_size)}</span>
            <span>•</span>
            <span className="capitalize">{metadata.content_type || 'Document'}</span>
          </div>
        </div>

        {/* Clear Action Buttons with Labeled Text */}
        <div className="flex items-center space-x-2">
          {status === 'processed' && viewMode === 'invoice' && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              <span>✏️ Edit & Fix</span>
            </button>
          )}

          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>🔄 Reprocess</span>
          </button>

          <button
            onClick={() => copyToClipboard(JSON.stringify(document, null, 2))}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 text-sm font-bold transition-colors cursor-pointer shadow-xs"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : '📋 Copy JSON'}</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            title="Delete this document immediately"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
            <span>{isDeleting ? 'Deleting...' : '🗑️ Delete'}</span>
          </button>
        </div>
      </div>

      {/* Clean Segmented Navigation Bar */}
      <div className="px-5 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-start space-x-2">
        <button
          type="button"
          onClick={() => {
            setViewMode('invoice');
            setIsEditing(false);
          }}
          className={`px-4 py-2 rounded-xl text-base font-semibold transition-all cursor-pointer ${
            viewMode === 'invoice'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-300'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          📄 Invoice Summary
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('raw');
            setIsEditing(false);
          }}
          className={`px-4 py-2 rounded-xl text-base font-semibold transition-all cursor-pointer ${
            viewMode === 'raw'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-300'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          📝 Raw Extracted Text
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('history');
            setIsEditing(false);
          }}
          className={`px-4 py-2 rounded-xl text-base font-semibold transition-all cursor-pointer flex items-center space-x-2 ${
            viewMode === 'history'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-300'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
          }`}
        >
          <History className="h-4.5 w-4.5" />
          <span>🕒 History ({history_logs.length})</span>
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ACTION SUCCESS BANNER */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-base flex items-center space-x-3 animate-fade-in shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{actionSuccessMessage}</span>
          </div>
        )}

        {/* FAILED FILE NOTICE */}
        {status === 'failed' && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 space-y-3.5 shadow-xs">
            <div className="flex items-center space-x-3 text-rose-900 font-bold text-lg">
              <AlertOctagon className="h-6 w-6 shrink-0 text-rose-600" />
              <span>Could Not Read Document (Corrupted or Damaged File)</span>
            </div>
            <p className="text-base text-rose-800 leading-relaxed pl-9 font-medium">
              {error_details?.error_reason || 'This file has corrupted magic bytes or an unreadable header.'}
            </p>
            <div className="pl-9 flex items-center space-x-4 pt-1">
              <span className="text-sm text-slate-600 font-medium">
                Code: <code className="font-mono bg-white px-2.5 py-1 rounded-md border border-rose-300 font-bold text-rose-900">{error_details?.error_code}</code>
              </span>
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-xl bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                <span>Retry Processing</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: INVOICE SUMMARY (REAL-WORLD BANGLADESHI BILL / CHALLAN VIEW) */}
        {/* ==================================================================== */}
        {status === 'processed' && viewMode === 'invoice' && !isEditing && (
          <div className="space-y-6">
            {/* 1. TOP STATUS BOX (BIG & CLEAR) */}
            {validation_result && (
              <>
                {validation_result.duplicate_info ? (
                  <div className="p-5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 space-y-2 shadow-xs">
                    <div className="flex items-center space-x-2.5 font-bold text-lg text-purple-900">
                      <AlertTriangle className="h-5 w-5 text-purple-700 shrink-0" />
                      <span>⚠️ Duplicate Invoice Detected</span>
                    </div>
                    <p className="text-base text-purple-900 pl-7 leading-relaxed font-medium">
                      Matches previously recorded invoice <strong>#{validation_result.duplicate_info.invoice_number}</strong> from <strong>{validation_result.duplicate_info.supplier_name}</strong>.
                    </p>
                  </div>
                ) : validation_result.validation_status === 'valid' ? (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-emerald-950">
                          ✅ Invoice is 100% Correct (All calculations match)
                        </h4>
                        <p className="text-base font-medium text-emerald-800 mt-1 leading-relaxed">
                          Supplier, invoice number, and math check (Subtotal + VAT = Total) are all verified in Bangladeshi Taka (৳ BDT).
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5 font-bold text-lg text-amber-950">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <span>Attention Required: {failedRules.length} Issue(s) Detected</span>
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>✏️ Click Here to Fix Now</span>
                      </button>
                    </div>

                    {/* Explanations in Plain English */}
                    <ul className="space-y-2 pl-7 text-base text-amber-950 list-disc font-medium leading-relaxed">
                      {failedRules.map((rule) => (
                        <li key={rule.rule_id}>
                          <strong>{rule.rule_name}:</strong> {rule.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* 2. BILL DETAILS CARD */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* From / Supplier */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Building className="h-4 w-4 text-slate-400" />
                    <span>From (Supplier)</span>
                  </span>
                  <p className="text-base font-bold text-slate-900">
                    {extraction_data?.supplier_name || (
                      <span className="text-rose-600 font-semibold italic">Missing Supplier Name</span>
                    )}
                  </p>
                </div>

                {/* Bill To / Customer */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>Bill To (Customer)</span>
                  </span>
                  <p className="text-base font-bold text-slate-900">
                    {extraction_data?.customer_name || <span className="text-slate-400 font-normal italic">—</span>}
                  </p>
                </div>

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Hash className="h-4 w-4 text-slate-400" />
                    <span>Invoice Number</span>
                  </span>
                  <p className="text-base font-mono font-bold text-indigo-700">
                    {extraction_data?.invoice_number ? `#${extraction_data.invoice_number}` : <span className="text-rose-600 font-semibold italic">None</span>}
                  </p>
                </div>

                {/* Invoice Date */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Invoice Date</span>
                  </span>
                  <p className="text-base font-bold text-slate-900">
                    {extraction_data?.invoice_date || <span className="text-slate-400 font-normal italic">—</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. ITEMS TABLE */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="px-5 py-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Billed Items & Products ({extraction_data?.line_items?.length || 0})
                </span>
                <span className="text-sm font-semibold text-slate-600">
                  Currency: <strong className="text-slate-900">{extraction_data?.currency || 'BDT'}</strong>
                </span>
              </div>

              {extraction_data?.line_items && extraction_data.line_items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-sm border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-5 w-1/2">Item Description</th>
                        <th className="py-3.5 px-4 text-right">Qty</th>
                        <th className="py-3.5 px-4 text-right">Unit Price</th>
                        <th className="py-3.5 px-5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base">
                      {extraction_data.line_items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-slate-900">
                            {item.description || <span className="italic text-slate-400">Unlabeled Item</span>}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-700 font-mono font-medium">
                            {item.quantity ?? '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-700 font-mono font-medium">
                            {item.unit_price !== null && item.unit_price !== undefined ? formatBDT(item.unit_price) : '—'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-slate-950 font-mono">
                            {item.line_total !== null && item.line_total !== undefined ? formatBDT(item.line_total) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">
                  No individual line items parsed from this document.
                </div>
              )}
            </div>

            {/* 4. FINAL CALCULATION BOX (BOTTOM RIGHT) */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 bg-slate-50 border border-slate-300 rounded-2xl p-5 space-y-3 shadow-xs">
                <div className="flex justify-between text-sm text-slate-700">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {formatBDT(extraction_data?.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-700">
                  <span className="font-semibold">VAT / Tax (15%):</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {formatBDT(extraction_data?.tax)}
                  </span>
                </div>
                <div className="border-t border-slate-300 pt-3 flex justify-between items-baseline">
                  <span className="text-base font-bold text-slate-900">Grand Total:</span>
                  <span className="text-2xl font-black text-emerald-800 font-mono">
                    {formatBDT(extraction_data?.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* INTERACTIVE "EDIT & FIX" MODE (TASK 6) */}
        {/* ==================================================================== */}
        {status === 'processed' && isEditing && (
          <div className="space-y-6 bg-indigo-50/40 p-6 rounded-2xl border border-indigo-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-indigo-200 pb-3.5">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                <h4 className="text-base font-bold text-slate-900">
                  Interactive Correction Mode (Bangladeshi Taka ৳)
                </h4>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>

            {/* Core Header Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Invoice Number</label>
                <input
                  type="text"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-WALTON-2026-01"
                  className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-mono font-semibold focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Invoice Date</label>
                <input
                  type="date"
                  value={editInvoiceDate}
                  onChange={(e) => setEditInvoiceDate(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-semibold focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Supplier Name (From)</label>
                <input
                  type="text"
                  value={editSupplierName}
                  onChange={(e) => setEditSupplierName(e.target.value)}
                  placeholder="e.g. Walton Hi-Tech Industries"
                  className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-semibold focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Customer Name (Bill To)</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="e.g. Care Guide BD"
                  className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-semibold focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>
            </div>

            {/* Line Items Editor */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Line Items</span>
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={handleAutoSumLineItems}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                  >
                    <Calculator className="h-4 w-4" />
                    <span>Auto-Calculate Totals</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {editLineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                      placeholder="Item Description"
                      className="flex-2 text-sm p-2 border border-slate-300 rounded-lg font-medium"
                    />
                    <input
                      type="number"
                      value={item.quantity ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-20 text-sm p-2 border border-slate-300 rounded-lg font-mono text-right font-medium"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value)}
                      placeholder="Price (৳)"
                      className="w-28 text-sm p-2 border border-slate-300 rounded-lg font-mono text-right font-medium"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.line_total ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'line_total', e.target.value)}
                      placeholder="Total (৳)"
                      className="w-28 text-sm p-2 border border-slate-300 rounded-lg font-mono text-right font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Subtotal (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editSubtotal}
                  onChange={(e) => setEditSubtotal(e.target.value)}
                  className="w-full text-base p-3 rounded-xl bg-white border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">VAT / Tax (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTax}
                  onChange={(e) => setEditTax(e.target.value)}
                  className="w-full text-base p-3 rounded-xl bg-white border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Grand Total (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="w-full text-base p-3 rounded-xl bg-white border-2 border-emerald-500 font-mono font-black text-emerald-800"
                />
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-indigo-200">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-6 py-3 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{isSaving ? 'Saving & Re-Verifying...' : 'Save & Re-Verify Calculations'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: RAW EXTRACTED TEXT / TABLE (TASK 1) */}
        {/* ==================================================================== */}
        {status === 'processed' && viewMode === 'raw' && (
          <div className="space-y-4">
            {hasPages && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>Page {activePageIndex + 1} of {pages.length}</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                      disabled={activePageIndex === 0}
                      className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActivePageIndex((p) => Math.min(pages.length - 1, p + 1))}
                      disabled={activePageIndex === pages.length - 1}
                      className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-slate-900 text-slate-100 rounded-2xl font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[520px]">
                  {currentPage?.text || 'No text extracted for this page.'}
                </div>
              </div>
            )}

            {hasSheets && (
              <div className="space-y-3">
                <SpreadsheetViewer sheets={sheets} />
              </div>
            )}

            {!hasPages && !hasSheets && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                {extracted_content?.text_summary || 'No text content available.'}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: AUDIT HISTORY TIMELINE (TASK 5) */}
        {/* ==================================================================== */}
        {viewMode === 'history' && (
          <div className="space-y-5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Audit Trail & Lifecycle Events ({history_logs.length})
            </h4>

            {history_logs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center font-medium">No audit history recorded yet.</p>
            ) : (
              <div className="relative pl-7 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history_logs.map((log, idx) => (
                  <div key={idx} className="relative text-sm space-y-1">
                    <div className="absolute -left-7 top-1.5 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                    <div className="flex items-center space-x-2.5">
                      <span className="font-bold text-slate-900 capitalize text-base">{log.action.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200 font-medium leading-relaxed">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};