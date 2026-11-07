import React, { useState } from 'react';
import { Table, Search, Download } from 'lucide-react';
import type { SheetData } from '../types/document';

interface SpreadsheetViewerProps {
  sheets: Record<string, SheetData>;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ sheets }) => {
  const sheetNames = Object.keys(sheets);
  const [activeSheetName, setActiveSheetName] = useState<string>(sheetNames[0] || '');
  const [searchQuery, setSearchQuery] = useState('');

  if (sheetNames.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No spreadsheet data available.
      </div>
    );
  }

  const currentSheet = sheets[activeSheetName] || sheets[sheetNames[0]];
  const columns = currentSheet?.columns || [];
  const records = currentSheet?.records || [];

  const filteredRecords = records.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(q));
  });

  const exportAsJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeSheetName}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Bar: Sheet Tabs, Search, and Export */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {sheetNames.map((name) => {
            const isActive = name === activeSheetName;
            const sheetMeta = sheets[name];
            return (
              <button
                key={name}
                onClick={() => {
                  setActiveSheetName(name);
                  setSearchQuery('');
                }}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-transparent'
                }`}
              >
                <Table className="h-3.5 w-3.5 text-emerald-600" />
                <span>{name}</span>
                <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.2 rounded-full border border-slate-200">
                  {sheetMeta.row_count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-44">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={exportAsJSON}
            title="Download JSON"
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-auto border border-slate-200 rounded-lg bg-white max-h-[360px]">
        {columns.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            Empty spreadsheet (No data columns found).
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2 px-3 w-10 text-center text-slate-400 text-[10px]">#</th>
                {columns.map((col, idx) => (
                  <th key={idx} className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-6 text-center text-slate-400">
                    No matching rows found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-1.5 px-3 text-center text-slate-400 text-[10px]">
                      {rIdx + 1}
                    </td>
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className="py-1.5 px-3 border-r border-slate-100 whitespace-nowrap">
                        {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
