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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Documents */}
      <button
        type="button"
        onClick={() => onSelectFilter('all')}
        className={`text-left p-5 rounded-2xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'all'
            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-slate-700">
          <span className="text-base font-semibold text-slate-800">Total Documents</span>
          <Files className="h-5 w-5 text-slate-500" />
        </div>
        <div className="mt-2.5 flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{total}</span>
          <span className="text-sm font-semibold text-slate-600">uploaded</span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-slate-500">All submitted files</div>
      </button>

      {/* 2. Ready & Verified */}
      <button
        type="button"
        onClick={() => onSelectFilter('valid')}
        className={`text-left p-5 rounded-2xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'valid'
            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30'
            : 'border-slate-200 hover:border-emerald-300'
        }`}
      >
        <div className="flex items-center justify-between text-emerald-800">
          <span className="text-base font-semibold text-emerald-800">Ready & Verified</span>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="mt-2.5 flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">{verified}</span>
          <span className="text-sm font-bold text-emerald-700">
            {total > 0 ? `${Math.round((verified / total) * 100)}%` : '0%'}
          </span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-slate-600">All checks passed</div>
      </button>

      {/* 3. Needs Attention */}
      <button
        type="button"
        onClick={() => onSelectFilter('needs_review')}
        className={`text-left p-5 rounded-2xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'needs_review'
            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30'
            : 'border-slate-200 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between text-amber-900">
          <span className="text-base font-semibold text-amber-900">Needs Attention</span>
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="mt-2.5 flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-amber-800 tracking-tight font-mono">{needsAttention}</span>
          <span className="text-sm font-bold text-amber-700">issues</span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-slate-600">Math mismatch, missing info, dup</div>
      </button>

      {/* 4. Failed to Read */}
      <button
        type="button"
        onClick={() => onSelectFilter('failed')}
        className={`text-left p-5 rounded-2xl border bg-white transition-all cursor-pointer shadow-xs ${
          activeFilter === 'failed'
            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30'
            : 'border-slate-200 hover:border-rose-300'
        }`}
      >
        <div className="flex items-center justify-between text-rose-800">
          <span className="text-base font-semibold text-rose-800">Failed to Read</span>
          <AlertOctagon className="h-5 w-5 text-rose-600" />
        </div>
        <div className="mt-2.5 flex items-baseline space-x-2">
          <span className="text-3xl font-extrabold text-rose-700 tracking-tight font-mono">{failed}</span>
          <span className="text-sm font-bold text-rose-700">unreadable</span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-slate-600">Corrupted or empty file</div>
      </button>
    </div>
  );
};