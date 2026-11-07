import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  FileQuestion,
  Copy,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { DocumentResponse, ExtractionMethod, ValidationStatus } from '../types/document';

interface DocumentCardProps {
  document: DocumentResponse;
  onInspect: (doc: DocumentResponse) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onInspect }) => {
  const { filename, status, file_size, metadata, extraction_data, validation_result, error_details } = document;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="h-5 w-5 text-rose-400" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
    }
    if (['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext || '')) {
      return <FileImage className="h-5 w-5 text-cyan-400" />;
    }
    return <FileQuestion className="h-5 w-5 text-slate-400" />;
  };

  const getMethodBadge = (method: ExtractionMethod) => {
    switch (method) {
      case 'digital_pdf':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Digital PDF
          </span>
        );
      case 'ocr':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            OCR
          </span>
        );
      case 'spreadsheet_parser':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Spreadsheet
          </span>
        );
      default:
        return null;
    }
  };

  const getValidationBadge = (statusVal?: ValidationStatus) => {
    if (!validation_result) return null;

    if (validation_result.duplicate_info) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <Copy className="h-3 w-3" />
          <span>Duplicate</span>
        </span>
      );
    }

    switch (statusVal) {
      case 'valid':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>Valid</span>
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            <span>Needs Review</span>
          </span>
        );
      case 'invalid':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="h-3 w-3" />
            <span>Invalid</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="group bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left: File Info & Extracted Details */}
      <div className="flex items-start space-x-3.5 min-w-0 flex-1">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center group-hover:scale-105 transition-transform mt-0.5">
          {getFileIcon()}
        </div>

        <div className="min-w-0 flex-1">
          {/* Top row: Filename, Method, Confidence */}
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md" title={filename}>
              {filename}
            </h4>
            {status === 'processed' && getMethodBadge(metadata.extraction_method)}

            {extraction_data && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                <span>{Math.round(extraction_data.extraction_confidence * 100)}% Conf</span>
              </span>
            )}
          </div>

          {/* Middle row: Task 2 Extracted Summary Preview */}
          {status === 'processed' && extraction_data && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {extraction_data.invoice_number ? (
                <span className="text-slate-200 font-mono font-medium">
                  #{extraction_data.invoice_number}
                </span>
              ) : (
                <span className="text-slate-500 italic">No Inv #</span>
              )}

              {extraction_data.supplier_name && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 truncate max-w-xs font-medium">
                    {extraction_data.supplier_name}
                  </span>
                </>
              )}

              {extraction_data.total !== null && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {extraction_data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {extraction_data.currency || ''}
                  </span>
                </>
              )}

              {extraction_data.line_items.length > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">
                    {extraction_data.line_items.length} line item(s)
                  </span>
                </>
              )}
            </div>
          )}

          {/* Bottom row: Size, Latency & Error Reason */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
            <span>{formatFileSize(file_size)}</span>
            <span className="text-slate-600">•</span>

            {status === 'processed' ? (
              <>
                <span className="flex items-center space-x-1 text-slate-400">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>{metadata.processing_time_ms.toFixed(1)} ms</span>
                </span>
                {metadata.page_count > 0 && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center space-x-1">
                      <Layers className="h-3 w-3 text-slate-500" />
                      <span>{metadata.page_count} pg</span>
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-rose-400 font-medium">
                {error_details?.error_code || 'PROCESSING_FAILED'}: {error_details?.error_reason}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Validation Badge & Action */}
      <div className="flex items-center justify-between md:justify-end space-x-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
        {status === 'processed' ? (
          getValidationBadge(validation_result?.validation_status)
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Failed
          </span>
        )}

        <button
          onClick={() => onInspect(document)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Inspect</span>
        </button>
      </div>
    </div>
  );
};
