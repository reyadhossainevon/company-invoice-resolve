import React from 'react';
import { Files, CheckCircle2, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import type { DocumentResponse } from '../types/document';

interface StatsBannerProps {
  documents: DocumentResponse[];
  totalProcessingTime: number;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({ documents, totalProcessingTime }) => {
  const total = documents.length;
  const processed = documents.filter((d) => d.status === 'processed');
  const failed = documents.filter((d) => d.status === 'failed').length;
  const avgTime = total > 0 ? (totalProcessingTime / total).toFixed(1) : '0';

  // Task 3 Validation Metrics
  const validCount = processed.filter(
    (d) => d.validation_result?.validation_status === 'valid'
  ).length;

  const reviewCount = processed.filter(
    (d) => d.validation_result?.requires_manual_review === true
  ).length;

  const duplicateCount = processed.filter(
    (d) => d.validation_result?.duplicate_info !== null && d.validation_result?.duplicate_info !== undefined
  ).length;

  // Math rules metrics
  let mathChecksTotal = 0;
  let mathChecksPassed = 0;
  processed.forEach((d) => {
    d.validation_result?.rule_results?.forEach((r) => {
      if (r.category === 'math_verification' || r.category === 'line_item_math') {
        mathChecksTotal++;
        if (r.status === 'passed') mathChecksPassed++;
      }
    });
  });

  const mathPassRate = mathChecksTotal > 0 ? Math.round((mathChecksPassed / mathChecksTotal) * 100) : 100;

  if (total === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
      {/* 1. Total Files */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Ingested</span>
          <Files className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{total}</span>
          <span className="text-xs text-slate-400">
            {failed > 0 ? `(${failed} failed/corrupted)` : 'files'}
          </span>
        </div>
      </div>

      {/* 2. Fully Validated Invoices (Task 3) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Validated Invoices</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-emerald-400 tracking-tight">{validCount}</span>
          <span className="text-xs text-emerald-400/80 font-medium">
            {processed.length > 0 ? `${Math.round((validCount / processed.length) * 100)}% Pass` : '0%'}
          </span>
        </div>
      </div>

      {/* 3. Manual Review Required (Task 3) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Requires Review</span>
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-amber-400 tracking-tight">{reviewCount}</span>
          <span className="text-xs text-slate-400">
            {duplicateCount > 0 ? `${duplicateCount} dup` : 'flagged'}
          </span>
        </div>
      </div>

      {/* 4. Math Check Cross-Verification Rate */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Math Cross-Check</span>
          <ShieldAlert className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-cyan-400 tracking-tight">{mathPassRate}%</span>
          <span className="text-xs text-slate-400">
            {mathChecksPassed}/{mathChecksTotal} checks
          </span>
        </div>
      </div>

      {/* 5. Latency */}
      <div className="col-span-2 lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Pipeline Latency</span>
          <Clock className="h-4 w-4 text-violet-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-white tracking-tight">{totalProcessingTime.toFixed(0)}</span>
          <span className="text-xs text-slate-400">ms ({avgTime} ms/file)</span>
        </div>
      </div>
    </div>
  );
};
