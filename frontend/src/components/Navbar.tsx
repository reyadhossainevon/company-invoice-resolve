import React from 'react';
import { FileText, RefreshCw, BarChart3, ArrowRightLeft } from 'lucide-react';

interface NavbarProps {
  onOpenMetrics: () => void;
  onOpenCompare: () => void;
  onLoadSamples: () => void;
  isLoadingSamples: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMetrics,
  onOpenCompare,
  onLoadSamples,
  isLoadingSamples,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              DocuIntellect
            </h1>
            <p className="text-xs text-slate-500">AI Invoice & Document Intelligence (BDT ৳)</p>
          </div>
        </div>

        {/* 3 Simple Top Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Button 1: Accuracy Report */}
          <button
            onClick={onOpenMetrics}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <span>📊 Accuracy Report</span>
          </button>

          {/* Button 2: Compare PDF & Excel */}
          <button
            onClick={onOpenCompare}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
            <span>🔍 Compare PDF & Excel</span>
          </button>

          {/* Button 3: Load Demo Invoices (BDT) */}
          <button
            onClick={onLoadSamples}
            disabled={isLoadingSamples}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60 cursor-pointer"
          >
            {isLoadingSamples ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading Demo...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>🔄 Load Demo Invoices (BDT)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
