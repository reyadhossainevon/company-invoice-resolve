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
      setEditLineItems(
        (ext.line_items || []).map((li) => ({
          description: li.description || '',
          quantity: li.quantity,
          unit_price: li.unit_price,
          line_total: li.line_total,
        }))
      );
      setEditNote('');
    }
  }, [document?.file_id]);

  if (!document) {
    return (
      <div className="h-full min-h-[520px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3 border border-indigo-100">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">No Invoice Selected</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Select any invoice or document from the list on the left to inspect amounts, verify calculations, or make corrections.
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

  const handleSaveCorrection = async () => {
    setIsSaving(true);
    try {
      const payload = {
        invoice_number: editInvoiceNumber.trim() || null,
        invoice_date: editInvoiceDate.trim() || null,
        supplier_name: editSupplierName.trim() || null,
        customer_name: editCustomerName.trim() || null,
        currency: editCurrency.trim() || 'BDT',
        subtotal: editSubtotal.trim() !== '' ? parseFloat(editSubtotal) : null,
        tax: editTax.trim() !== '' ? parseFloat(editTax) : null,
        total: editTotal.trim() !== '' ? parseFloat(editTotal) : null,
        line_items: editLineItems.map((li) => ({
          description: li.description || null,
          quantity: li.quantity !== null && li.quantity !== undefined ? Number(li.quantity) : null,
          unit_price: li.unit_price !== null && li.unit_price !== undefined ? Number(li.unit_price) : null,
          line_total: li.line_total !== null && li.line_total !== undefined ? Number(li.line_total) : null,
        })),
        edit_note: editNote.trim() || 'Manual correction saved by user',
      };

      const updated = await correctDocument(document.file_id, payload);
      setIsEditing(false);
      setActionSuccessMessage('Invoice updated successfully! All calculations re-verified.');
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

  const handleReprocess = async () => {
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
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md" title={filename}>
              {filename}
            </h3>
            {status === 'processed' ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Ready ({metadata.processing_time_ms.toFixed(0)}ms)
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Failed
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
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
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>✏️ Edit & Fix</span>
            </button>
          )}

          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReprocessing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>🔄 Reprocess</span>
          </button>

          <button
            onClick={() => copyToClipboard(JSON.stringify(document, null, 2))}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : '📋 Copy JSON'}</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="Delete this document immediately"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
            <span>{isDeleting ? 'Deleting...' : '🗑️ Delete'}</span>
          </button>
        </div>
      </div>

      {/* Clean Segmented Navigation Bar (Only 3 Simple Options) */}
      <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-start space-x-2">
        <button
          type="button"
          onClick={() => {
            setViewMode('invoice');
            setIsEditing(false);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'invoice'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
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
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            viewMode === 'raw'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
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
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
            viewMode === 'history'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>🕒 History ({history_logs.length})</span>
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ACTION SUCCESS BANNER */}
        {actionSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-fade-in shadow-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
        )}

        {/* FAILED FILE NOTICE */}
        {status === 'failed' && (
          <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 space-y-3 shadow-xs">
            <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <span>Could Not Read Document (Corrupted or Damaged File)</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed pl-7">
              {error_details?.error_reason || 'This file has corrupted magic bytes or an unreadable header.'}
            </p>
            <div className="pl-7 flex items-center space-x-3 pt-1">
              <span className="text-[11px] text-slate-500">
                Code: <code className="font-mono bg-white px-2 py-0.5 rounded border border-rose-200">{error_details?.error_code}</code>
              </span>
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                <span>Retry Processing</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: INVOICE SUMMARY (REAL-WORLD BANGLADESHI BILL / CHALLAN VIEW) */}
        {/* ==================================================================== */}
        {status === 'processed' && viewMode === 'invoice' && !isEditing && (
          <div className="space-y-5">
            {/* 1. TOP STATUS BOX (BIG & CLEAR) */}
            {validation_result && (
              <>
                {validation_result.duplicate_info ? (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 space-y-1.5 shadow-xs">
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <AlertTriangle className="h-4 w-4 text-purple-700 shrink-0" />
                      <span>⚠️ Duplicate Invoice Detected</span>
                    </div>
                    <p className="text-xs text-purple-800 pl-6 leading-relaxed">
                      Matches previously recorded invoice <strong>#{validation_result.duplicate_info.invoice_number}</strong> from <strong>{validation_result.duplicate_info.supplier_name}</strong>.
                    </p>
                  </div>
                ) : validation_result.validation_status === 'valid' ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900">
                          ✅ Invoice is 100% Correct (All calculations match)
                        </h4>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Supplier, invoice number, and math check (Subtotal + VAT = Total) are all verified in Bangladeshi Taka (৳ BDT).
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-xs space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 font-bold text-xs text-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Attention Required: {failedRules.length} Issue(s) Detected</span>
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>✏️ Click Here to Fix Now</span>
                      </button>
                    </div>

                    {/* Explanations in Plain English */}
                    <ul className="space-y-1.5 pl-6 text-xs text-amber-900 list-disc">
                      {failedRules.map((rule) => (
                        <li key={rule.rule_id} className="leading-relaxed">
                          <strong>{rule.rule_name}:</strong> {rule.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* 2. BILL DETAILS CARD */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* From / Supplier */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>From (Supplier)</span>
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {extraction_data?.supplier_name || (
                      <span className="text-rose-500 font-normal italic">Missing Supplier Name</span>
                    )}
                  </p>
                </div>

                {/* Bill To / Customer */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Bill To (Customer)</span>
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {extraction_data?.customer_name || <span className="text-slate-400 font-normal italic">—</span>}
                  </p>
                </div>

                {/* Invoice Number */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span>Invoice Number</span>
                  </span>
                  <p className="text-sm font-mono font-bold text-indigo-700">
                    {extraction_data?.invoice_number ? `#${extraction_data.invoice_number}` : <span className="text-rose-500 font-normal italic">None</span>}
                  </p>
                </div>

                {/* Invoice Date */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Invoice Date</span>
                  </span>
                  <p className="text-sm font-medium text-slate-800">
                    {extraction_data?.invoice_date || <span className="text-slate-400 font-normal italic">—</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. ITEMS TABLE */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Billed Items & Products ({extraction_data?.line_items?.length || 0})
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Currency: <strong>{extraction_data?.currency || 'BDT'}</strong>
                </span>
              </div>

              {extraction_data?.line_items && extraction_data.line_items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-1/2">Item Description</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extraction_data.line_items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {item.description || <span className="italic text-slate-400">Unlabeled Item</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {item.quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {item.unit_price !== null && item.unit_price !== undefined ? formatBDT(item.unit_price) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                            {item.line_total !== null && item.line_total !== undefined ? formatBDT(item.line_total) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No individual line items parsed from this document.
                </div>
              )}
            </div>

            {/* 4. FINAL CALCULATION BOX (BOTTOM RIGHT) */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatBDT(extraction_data?.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>VAT / Tax (15%):</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatBDT(extraction_data?.tax)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-900">Grand Total:</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono">
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
          <div className="space-y-5 bg-indigo-50/30 p-5 rounded-xl border border-indigo-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Interactive Correction Mode (Bangladeshi Taka ৳)
                </h4>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            </div>

            {/* Core Header Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-WALTON-2026-01"
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={editInvoiceDate}
                  onChange={(e) => setEditInvoiceDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Supplier Name (From)</label>
                <input
                  type="text"
                  value={editSupplierName}
                  onChange={(e) => setEditSupplierName(e.target.value)}
                  placeholder="e.g. Walton Hi-Tech Industries"
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Customer Name (Bill To)</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="e.g. Care Guide BD"
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>
            </div>

            {/* Line Items Editor */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase">Line Items</span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleAutoSumLineItems}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>Auto-Calculate Totals</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {editLineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                      placeholder="Item Description"
                      className="flex-2 text-xs p-1.5 border border-slate-200 rounded"
                    />
                    <input
                      type="number"
                      value={item.quantity ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-16 text-xs p-1.5 border border-slate-200 rounded font-mono text-right"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value)}
                      placeholder="Price (৳)"
                      className="w-24 text-xs p-1.5 border border-slate-200 rounded font-mono text-right"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.line_total ?? ''}
                      onChange={(e) => handleLineItemChange(idx, 'line_total', e.target.value)}
                      placeholder="Total (৳)"
                      className="w-24 text-xs p-1.5 border border-slate-200 rounded font-mono text-right font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Subtotal (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editSubtotal}
                  onChange={(e) => setEditSubtotal(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">VAT / Tax (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTax}
                  onChange={(e) => setEditTax(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Grand Total (৳ BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white border border-emerald-400 font-mono font-extrabold text-emerald-800"
                />
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-indigo-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
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
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Page {activePageIndex + 1} of {pages.length}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                      disabled={activePageIndex === 0}
                      className="p-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setActivePageIndex((p) => Math.min(pages.length - 1, p + 1))}
                      disabled={activePageIndex === pages.length - 1}
                      className="p-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px]">
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
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono whitespace-pre-wrap">
                {extracted_content?.text_summary || 'No text content available.'}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: AUDIT HISTORY TIMELINE (TASK 5) */}
        {/* ==================================================================== */}
        {viewMode === 'history' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Audit Trail & Lifecycle Events ({history_logs.length})
            </h4>

            {history_logs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No audit history recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history_logs.map((log, idx) => (
                  <div key={idx} className="relative text-xs space-y-0.5">
                    <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 capitalize">{log.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-slate-600 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
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
