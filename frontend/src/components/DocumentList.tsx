import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileQuestion,
  ChevronRight,
  Inbox,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { DocumentResponse } from '../types/document';
import { formatBDT } from '../utils/formatters';

interface DocumentListProps {
  documents: DocumentResponse[];
  selectedDocId: string | null;
  onSelectDoc: (doc: DocumentResponse) => void;
  activeFilter: 'all' | 'valid' | 'needs_review' | 'failed';
  onSelectFilter: (filter: 'all' | 'valid' | 'needs_review' | 'failed') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSearching?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  activeFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  isSearching = false,
}) => {
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="h-4 w-4 text-rose-500" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    }
    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext || '')) {
      return <FileImage className="h-4 w-4 text-sky-500" />;
    }
    return <FileQuestion className="h-4 w-4 text-slate-400" />;
  };

  const getStatusBadge = (doc: DocumentResponse) => {
    if (doc.status === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          ❌ Corrupted File
        </span>
      );
    }

    const val = doc.validation_result;
    if (!val) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          Processed
        </span>
      );
    }

    if (val.duplicate_info) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          ⚠️ Duplicate
        </span>
      );
    }

    if (val.validation_status === 'valid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✅ All OK / Verified
        </span>
      );
    }

    // Distinguish calculation mismatch vs missing fields
    const hasMathFailure = val.rule_results.some(
      (r) => (r.category === 'math_verification' || r.category === 'line_item_math' || r.rule_id === 'MATH_001') && r.status === 'failed'
    );
    if (hasMathFailure) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          ⚠️ Calculation Wrong
        </span>
      );
    }

    const hasMissingCrit = val.rule_results.some(
      (r) => (r.category === 'critical_fields' || r.rule_id === 'CRIT_001') && r.status === 'failed'
    );
    if (hasMissingCrit) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          ⚠️ Missing Info
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        ⚠️ Needs Attention
      </span>
    );
  };

  // Filter documents in memory if activeFilter is applied
  const filtered = documents.filter((doc) => {
    if (activeFilter === 'valid') {
      return doc.status === 'processed' && doc.validation_result?.validation_status === 'valid';
    }
    if (activeFilter === 'needs_review') {
      return doc.status === 'processed' && doc.validation_result?.requires_manual_review === true;
    }
    if (activeFilter === 'failed') {
      return doc.status === 'failed';
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Search Bar - Single Smart Hybrid Search Box */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 Search by company name, item, or invoice number..."
            className="w-full text-xs pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs placeholder:text-slate-400 text-slate-800 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Status Tabs & Count */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          <div className="flex flex-wrap gap-1 text-xs">
            <button
              onClick={() => onSelectFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium text-[11px] ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              All ({documents.length})
            </button>
            <button
              onClick={() => onSelectFilter('valid')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium text-[11px] ${
                activeFilter === 'valid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-emerald-50'
              }`}
            >
              Verified ({documents.filter((d) => d.validation_result?.validation_status === 'valid').length})
            </button>
            <button
              onClick={() => onSelectFilter('needs_review')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium text-[11px] ${
                activeFilter === 'needs_review'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-amber-50'
              }`}
            >
              Attention ({documents.filter((d) => d.validation_result?.requires_manual_review === true).length})
            </button>
            <button
              onClick={() => onSelectFilter('failed')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium text-[11px] ${
                activeFilter === 'failed'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-rose-50'
              }`}
            >
              Failed ({documents.filter((d) => d.status === 'failed').length})
            </button>
          </div>

          <span className="text-[11px] font-medium text-slate-400">
            {isSearching ? 'Searching...' : `${filtered.length} shown`}
          </span>
        </div>
      </div>

      {/* Documents Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[640px]">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">No documents match this search or filter.</p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          filtered.map((doc) => {
            const isSelected = doc.file_id === selectedDocId;
            const extData = doc.extraction_data;

            return (
              <div
                key={doc.file_id}
                onClick={() => onSelectDoc(doc)}
                className={`p-3.5 transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 shadow-xs'
                    : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {/* Top: Icon + Filename + Relevance Score */}
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.filename)}
                      </div>
                      <span className="text-xs font-semibold text-slate-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </div>

                    {doc.relevance_score !== null && doc.relevance_score !== undefined && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 shrink-0">
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>{Math.round(doc.relevance_score * 100)}% match</span>
                      </span>
                    )}
                  </div>

                  {/* Middle: Supplier & Inv # */}
                  <div className="mt-1 flex items-center space-x-2 text-[11px] text-slate-500 truncate">
                    {extData?.supplier_name ? (
                      <span className="text-slate-700 font-medium truncate max-w-[150px]">
                        {extData.supplier_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No supplier detected</span>
                    )}

                    {extData?.invoice_number && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-600">#{extData.invoice_number}</span>
                      </>
                    )}
                  </div>

                  {/* Bottom: Total & Status */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900">
                      {extData?.total !== null && extData?.total !== undefined ? (
                        formatBDT(extData.total)
                      ) : (
                        <span className="text-slate-400 font-normal italic">—</span>
                      )}
                    </div>
                    {getStatusBadge(doc)}
                  </div>
                </div>

                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'
                  }`}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
