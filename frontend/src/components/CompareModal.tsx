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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertOctagon className="h-3 w-3 mr-1" /> Corrupted File
        </span>
      );
    }
    if (doc.validation_result?.validation_status === 'valid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="h-3 w-3 mr-1" /> Needs Attention
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cross-Check & Compare Documents
              </h2>
              <p className="text-xs text-slate-500">
                Compare extracted amounts and metadata side-by-side between PDF challans and Excel ledgers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {documents.length < 2 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-semibold text-slate-700">At least 2 documents required to compare</p>
              <p className="text-xs text-slate-400 mt-1">Please upload more files or click "Load Demo Invoices (BDT)"</p>
            </div>
          ) : (
            <>
              {/* Selector Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Document A Selector */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Document A (e.g. PDF Challan)</span>
                    {getStatusPill(docA)}
                  </div>
                  <select
                    value={docA?.file_id || ''}
                    onChange={(e) => setDocAId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-slate-300 font-medium text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    {documents.map((d) => (
                      <option key={d.file_id} value={d.file_id}>
                        {d.filename} ({d.extraction_data?.supplier_name || 'Document'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document B Selector */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Document B (e.g. Excel Ledger)</span>
                    {getStatusPill(docB)}
                  </div>
                  <select
                    value={docB?.file_id || ''}
                    onChange={(e) => setDocBId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-slate-300 font-medium text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    {documents.map((d) => (
                      <option key={d.file_id} value={d.file_id}>
                        {d.filename} ({d.extraction_data?.supplier_name || 'Document'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-1/4">Field / Parameter</th>
                      <th className="py-3 px-4 w-1/3 text-indigo-900 bg-indigo-50/50">
                        <div className="flex items-center space-x-1.5">
                          {docA?.file_type?.includes('pdf') ? (
                            <FileText className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <span className="truncate max-w-[200px]">{docA?.filename}</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 w-1/3 text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          {docB?.file_type?.includes('pdf') ? (
                            <FileText className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <span className="truncate max-w-[200px]">{docB?.filename}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Supplier */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">From (Supplier)</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800 bg-indigo-50/20">
                        {extA?.supplier_name || <span className="text-rose-500 italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {extB?.supplier_name || <span className="text-rose-500 italic">Missing</span>}
                      </td>
                    </tr>

                    {/* Customer */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">Bill To (Customer)</td>
                      <td className="py-2.5 px-4 text-slate-800 bg-indigo-50/20">
                        {extA?.customer_name || <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {extB?.customer_name || <span className="text-slate-400 italic">—</span>}
                      </td>
                    </tr>

                    {/* Invoice Number */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">Invoice Number</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900 bg-indigo-50/20">
                        {extA?.invoice_number || <span className="text-rose-500 italic">None</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {extB?.invoice_number || <span className="text-rose-500 italic">None</span>}
                      </td>
                    </tr>

                    {/* Invoice Date */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">Invoice Date</td>
                      <td className="py-2.5 px-4 text-slate-700 bg-indigo-50/20">{extA?.invoice_date || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-700">{extB?.invoice_date || '—'}</td>
                    </tr>

                    {/* Subtotal */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">Subtotal</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 bg-indigo-50/20">
                        {formatBDT(extA?.subtotal)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {formatBDT(extB?.subtotal)}
                      </td>
                    </tr>

                    {/* Tax / VAT */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">VAT / Tax</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 bg-indigo-50/20">
                        {formatBDT(extA?.tax)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {formatBDT(extB?.tax)}
                      </td>
                    </tr>

                    {/* Grand Total */}
                    <tr className="bg-slate-50/80 font-bold">
                      <td className="py-3 px-4 text-slate-900">Grand Total (BDT)</td>
                      <td className="py-3 px-4 text-emerald-700 bg-indigo-50/40 text-sm">
                        {formatBDT(extA?.total)}
                      </td>
                      <td className="py-3 px-4 text-emerald-700 text-sm">
                        {formatBDT(extB?.total)}
                      </td>
                    </tr>

                    {/* Line Items Count */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-600">Line Items Count</td>
                      <td className="py-2.5 px-4 text-slate-700 bg-indigo-50/20">
                        {extA?.line_items?.length || 0} item(s)
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {extB?.line_items?.length || 0} item(s)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
