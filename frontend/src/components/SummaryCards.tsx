import React from 'react';
import { Files, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { DocumentResponse } from '../types/document';

interface SummaryCardsProps {
  documents: DocumentResponse[];
  activeFilter: 'all' | 'valid' | 'needs_review' | 'failed';
  onSelectFilter: (filter: 'all' | 'valid' | 'needs_review' | 'failed') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  documents,
  activeFilter,
  onSelectFilter,
}) => {
  const total = documents.length;
  const verified = documents.filter(
    (d) => d.status === 'processed' && d.validation_result?.validation_status === 'valid'
  ).length;

  const needsAttention = documents.filter(
    (d) => d.status === 'processed' && d.validation_result?.requires_manual_review === true
  ).length;

  const failed = documents.filter((d) => d.status === 'failed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
      {/* 1. Total Documents */}
      <button
        type="button"
        onClick={() => onSelectFilter('all')}
        className={`text-left p-4 rounded-xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'all'
            ? 'border-indigo-600 ring-2 ring-indigo-500/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">Total Documents</span>
          <Files className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{total}</span>
          <span className="text-xs text-slate-500">uploaded</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">All submitted files</div>
      </button>

      {/* 2. Ready & Verified */}
      <button
        type="button"
        onClick={() => onSelectFilter('valid')}
        className={`text-left p-4 rounded-xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'valid'
            ? 'border-emerald-600 ring-2 ring-emerald-500/10 bg-emerald-50/20'
            : 'border-slate-200 hover:border-emerald-300'
        }`}
      >
        <div className="flex items-center justify-between text-emerald-700">
          <span className="text-xs font-semibold">Ready & Verified</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-emerald-700 tracking-tight">{verified}</span>
          <span className="text-xs text-emerald-600">
            {total > 0 ? `${Math.round((verified / total) * 100)}%` : '0%'}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">All checks passed</div>
      </button>

      {/* 3. Needs Attention */}
      <button
        type="button"
        onClick={() => onSelectFilter('needs_review')}
        className={`text-left p-4 rounded-xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'needs_review'
            ? 'border-amber-500 ring-2 ring-amber-500/10 bg-amber-50/20'
            : 'border-slate-200 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between text-amber-800">
          <span className="text-xs font-semibold">Needs Attention</span>
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-amber-800 tracking-tight">{needsAttention}</span>
          <span className="text-xs text-amber-600">issues</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Math mismatch, missing info, dup</div>
      </button>

      {/* 4. Failed to Read */}
      <button
        type="button"
        onClick={() => onSelectFilter('failed')}
        className={`text-left p-4 rounded-xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'failed'
            ? 'border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/20'
            : 'border-slate-200 hover:border-rose-300'
        }`}
      >
        <div className="flex items-center justify-between text-rose-700">
          <span className="text-xs font-semibold">Failed to Read</span>
          <AlertOctagon className="h-4 w-4 text-rose-600" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-rose-700 tracking-tight">{failed}</span>
          <span className="text-xs text-rose-600">unreadable</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Corrupted or empty file</div>
      </button>
    </div>
  );
};
