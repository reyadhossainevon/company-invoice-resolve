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
  Trash2,
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
  onDeleteDoc?: (fileId: string) => void;
  onClearAll?: () => void;
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
  onDeleteDoc,
  onClearAll,
}) => {
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="h-5 w-5 text-rose-500" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    }
    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext || '')) {
      return <FileImage className="h-5 w-5 text-sky-500" />;
    }
    return <FileQuestion className="h-5 w-5 text-slate-500" />;
  };

  const getStatusBadge = (doc: DocumentResponse) => {
    if (doc.status === 'failed') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-rose-100 text-rose-800 border border-rose-300">
          ❌ Corrupted File
        </span>
      );
    }

    const val = doc.validation_result;
    if (!val) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-slate-100 text-slate-800">
          Processed
        </span>
      );
    }

    if (val.duplicate_info) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-purple-100 text-purple-900 border border-purple-300">
          ⚠️ Duplicate
        </span>
      );
    }

    if (val.validation_status === 'valid') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
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
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300">
          ⚠️ Calculation Wrong
        </span>
      );
    }

    const hasMissingCrit = val.rule_results.some(
      (r) => (r.category === 'critical_fields' || r.rule_id === 'CRIT_001') && r.status === 'failed'
    );
    if (hasMissingCrit) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300">
          ⚠️ Missing Info
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300">
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
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Search Bar - Single Smart Hybrid Search Box */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 Search by company name, item, or invoice number..."
            className="w-full text-sm pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs placeholder:text-slate-400 text-slate-900 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Status Tabs & Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => onSelectFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold text-xs ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              All ({documents.length})
            </button>
            <button
              onClick={() => onSelectFilter('valid')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold text-xs ${
                activeFilter === 'valid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              Verified ({documents.filter((d) => d.validation_result?.validation_status === 'valid').length})
            </button>
            <button
              onClick={() => onSelectFilter('needs_review')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold text-xs ${
                activeFilter === 'needs_review'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-900 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              Attention ({documents.filter((d) => d.validation_result?.requires_manual_review === true).length})
            </button>
            <button
              onClick={() => onSelectFilter('failed')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold text-xs ${
                activeFilter === 'failed'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-900 bg-rose-50 hover:bg-rose-100'
              }`}
            >
              Failed ({documents.filter((d) => d.status === 'failed').length})
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            {onClearAll && documents.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete ALL documents?')) {
                    onClearAll();
                  }
                }}
                className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                title="Clear all documents"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <span className="text-xs font-semibold text-slate-500">
              {isSearching ? 'Searching...' : `${filtered.length} shown`}
            </span>
          </div>
        </div>
      </div>

      {/* Documents Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[640px]">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Inbox className="h-10 w-10 mx-auto mb-2.5 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No documents match this search or filter.</p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mt-2 text-sm font-bold text-indigo-600 hover:underline cursor-pointer"
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
                className={`p-4 transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600 shadow-xs'
                    : 'hover:bg-slate-50/90 border-l-4 border-l-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {/* Top: Icon + Filename + Relevance Score */}
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        {getFileIcon(doc.filename)}
                      </div>
                      <span className="text-base font-bold text-slate-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </div>

                    {doc.relevance_score !== null && doc.relevance_score !== undefined && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-900 shrink-0">
                        <Sparkles className="h-3 w-3" />
                        <span>{Math.round(doc.relevance_score * 100)}% match</span>
                      </span>
                    )}
                  </div>

                  {/* Middle: Supplier & Inv # */}
                  <div className="mt-1.5 flex items-center space-x-2 text-sm text-slate-700 truncate">
                    {extData?.supplier_name ? (
                      <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                        {extData.supplier_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No supplier detected</span>
                    )}

                    {extData?.invoice_number && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-bold text-slate-700">#{extData.invoice_number}</span>
                      </>
                    )}
                  </div>

                  {/* Bottom: Total & Status */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="text-lg font-bold text-slate-950 font-mono">
                      {extData?.total !== null && extData?.total !== undefined ? (
                        formatBDT(extData.total)
                      ) : (
                        <span className="text-slate-400 font-normal italic">—</span>
                      )}
                    </div>
                    {getStatusBadge(doc)}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {onDeleteDoc && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${doc.filename}"?`)) {
                          onDeleteDoc(doc.file_id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title={`Delete ${doc.filename}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronRight
                    className={`h-5 w-5 transition-transform ${
                      isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-400'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};