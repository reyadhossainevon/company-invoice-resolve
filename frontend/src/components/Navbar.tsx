import React from 'react';
import { FileText, RefreshCw, BarChart3, ArrowRightLeft, Trash2 } from 'lucide-react';

interface NavbarProps {
  onOpenMetrics: () => void;
  onOpenCompare: () => void;
  onLoadSamples: () => void;
  isLoadingSamples: boolean;
  onClearAll?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMetrics,
  onOpenCompare,
  onLoadSamples,
  isLoadingSamples,
  onClearAll,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              DocuIntellect
            </h1>
            <p className="text-sm font-medium text-slate-500">AI Invoice & Document Intelligence (BDT ৳)</p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Button 1: Accuracy Report */}
          <button
            onClick={onOpenMetrics}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl border border-slate-300 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-800 hover:text-indigo-700 text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <BarChart3 className="h-4.5 w-4.5 text-indigo-600" />
            <span>📊 Accuracy Report</span>
          </button>

          {/* Button 2: Compare PDF & Excel */}
          <button
            onClick={onOpenCompare}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl border border-slate-300 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-800 hover:text-indigo-700 text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="h-4.5 w-4.5 text-emerald-600" />
            <span>🔍 Compare PDF & Excel</span>
          </button>

          {/* Button 3: Clear All */}
          {onClearAll && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all documents from the database?')) {
                  onClearAll();
                }
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold shadow-xs transition-colors cursor-pointer"
              title="Delete all documents from database"
            >
              <Trash2 className="h-4.5 w-4.5 text-red-600" />
              <span>🗑️ Clear All</span>
            </button>
          )}

          {/* Button 4: Load Demo Invoices (BDT) */}
          <button
            onClick={onLoadSamples}
            disabled={isLoadingSamples}
            className="inline-flex items-center space-x-2 px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs transition-all disabled:opacity-60 cursor-pointer"
          >
            {isLoadingSamples ? (
              <>
                <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                <span>Loading Demo...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4.5 w-4.5" />
                <span>🔄 Load Demo Invoices (BDT)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};