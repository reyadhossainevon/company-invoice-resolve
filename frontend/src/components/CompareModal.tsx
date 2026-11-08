import React, { useState } from 'react';
import { X, ArrowRightLeft, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { DocumentResponse } from '../types/document';
import { formatBDT } from '../utils/formatters';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentResponse[];
}

export const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose, documents }) => {
  const [docAId, setDocAId] = useState<string>(documents[0]?.file_id || '');
  const [docBId, setDocBId] = useState<string>(documents[1]?.file_id || documents[0]?.file_id || '');

  if (!isOpen) return null;

  const docA = documents.find((d) => d.file_id === docAId) || documents[0] || null;
  const docB = documents.find((d) => d.file_id === docBId) || documents[1] || null;

  const extA = docA?.extraction_data;
  const extB = docB?.extraction_data;

  const getStatusPill = (doc: DocumentResponse | null) => {
    if (!doc) return null;
    if (doc.status === 'failed') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200">
          <AlertOctagon className="h-4 w-4 mr-1.5 text-rose-600" /> Corrupted File
        </span>
      );
    }
    if (doc.validation_result?.validation_status === 'valid') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" /> Verified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-600" /> Needs Attention
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Cross-Check & Compare Documents
              </h2>
              <p className="text-base text-slate-600 mt-1">
                Compare extracted amounts, VAT, and line items side-by-side between PDF challans and Excel ledgers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {documents.length < 2 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-base font-bold text-slate-800">At least 2 documents are required to compare</p>
              <p className="text-sm text-slate-500 mt-1">Please upload more files or click "Load Demo Invoices (BDT)"</p>
            </div>
          ) : (
            <>
              {/* Document Selectors Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Document A Selector */}
                <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-950 uppercase tracking-wider">Document A (e.g. PDF Challan)</span>
                    {getStatusPill(docA)}
                  </div>
                  <select
                    value={docA?.file_id || ''}
                    onChange={(e) => setDocAId(e.target.value)}
                    className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-semibold text-slate-900 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {documents.map((d) => (
                      <option key={d.file_id} value={d.file_id}>
                        {d.filename} — {d.extraction_data?.supplier_name || 'Document'} ({formatBDT(d.extraction_data?.total)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document B Selector */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">Document B (e.g. Excel Ledger)</span>
                    {getStatusPill(docB)}
                  </div>
                  <select
                    value={docB?.file_id || ''}
                    onChange={(e) => setDocBId(e.target.value)}
                    className="w-full text-sm p-3 rounded-xl bg-white border border-slate-300 font-semibold text-slate-900 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {documents.map((d) => (
                      <option key={d.file_id} value={d.file_id}>
                        {d.filename} — {d.extraction_data?.supplier_name || 'Document'} ({formatBDT(d.extraction_data?.total)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-sm border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-5 w-1/4">Field / Parameter</th>
                      <th className="py-3.5 px-5 w-1/3 text-indigo-950 bg-indigo-50/60">
                        <div className="flex items-center space-x-2">
                          {docA?.file_type?.includes('pdf') ? (
                            <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate">{docA?.filename}</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-5 w-1/3 text-slate-900">
                        <div className="flex items-center space-x-2">
                          {docB?.file_type?.includes('pdf') ? (
                            <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate">{docB?.filename}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-base">
                    {/* Supplier */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">From (Supplier)</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 bg-indigo-50/20">
                        {extA?.supplier_name || <span className="text-rose-500 italic font-normal">Missing</span>}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        {extB?.supplier_name || <span className="text-rose-500 italic font-normal">Missing</span>}
                      </td>
                    </tr>

                    {/* Customer */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">Bill To (Customer)</td>
                      <td className="py-3.5 px-5 text-slate-900 bg-indigo-50/20">
                        {extA?.customer_name || <span className="text-slate-400 italic font-normal">—</span>}
                      </td>
                      <td className="py-3.5 px-5 text-slate-900">
                        {extB?.customer_name || <span className="text-slate-400 italic font-normal">—</span>}
                      </td>
                    </tr>

                    {/* Invoice Number */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">Invoice Number</td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 bg-indigo-50/20">
                        {extA?.invoice_number || <span className="text-rose-500 italic font-normal">None</span>}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                        {extB?.invoice_number || <span className="text-rose-500 italic font-normal">None</span>}
                      </td>
                    </tr>

                    {/* Invoice Date */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">Invoice Date</td>
                      <td className="py-3.5 px-5 text-slate-800 bg-indigo-50/20 font-medium">{extA?.invoice_date || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-800 font-medium">{extB?.invoice_date || '—'}</td>
                    </tr>

                    {/* Subtotal */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">Subtotal</td>
                      <td className="py-3.5 px-5 font-bold text-slate-900 bg-indigo-50/20">
                        {formatBDT(extA?.subtotal)}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {formatBDT(extB?.subtotal)}
                      </td>
                    </tr>

                    {/* Tax / VAT */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">VAT / Tax</td>
                      <td className="py-3.5 px-5 font-bold text-slate-900 bg-indigo-50/20">
                        {formatBDT(extA?.tax)}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {formatBDT(extB?.tax)}
                      </td>
                    </tr>

                    {/* Grand Total */}
                    <tr className="bg-slate-50/90 font-bold border-t-2 border-b-2 border-slate-300">
                      <td className="py-4 px-5 text-slate-950 text-base">Grand Total (BDT)</td>
                      <td className="py-4 px-5 text-emerald-700 bg-indigo-50/40 text-lg font-extrabold">
                        {formatBDT(extA?.total)}
                      </td>
                      <td className="py-4 px-5 text-emerald-700 text-lg font-extrabold">
                        {formatBDT(extB?.total)}
                      </td>
                    </tr>

                    {/* Line Items Count */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-700">Line Items Count</td>
                      <td className="py-3.5 px-5 text-slate-800 bg-indigo-50/20 font-medium">
                        {extA?.line_items?.length || 0} item(s)
                      </td>
                      <td className="py-3.5 px-5 text-slate-800 font-medium">
                        {extB?.line_items?.length || 0} item(s)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer shadow-xs transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};