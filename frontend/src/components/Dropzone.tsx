import React, { useRef, useState } from 'react';
import { UploadCloud, FileUp, Sparkles, AlertCircle, FileSpreadsheet, FileImage, FileText } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onRunSamples: () => void;
  isUploading: boolean;
  isSampleLoading: boolean;
}

const SUPPORTED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.xlsx', '.xls', '.csv'];
const MAX_SIZE_MB = 50;

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  onRunSamples,
  isUploading,
  isSampleLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const validateAndForwardFiles = (files: FileList | File[]) => {
    setValidationError(null);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];

    Array.from(files).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) {
        invalidFiles.push(file.name);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        oversizedFiles.push(file.name);
        return;
      }
      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      setValidationError(`Unsupported file types: ${invalidFiles.join(', ')}. Supported: ${SUPPORTED_EXTS.join(', ')}`);
    } else if (oversizedFiles.length > 0) {
      setValidationError(`Files exceed ${MAX_SIZE_MB}MB limit: ${oversizedFiles.join(', ')}`);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndForwardFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndForwardFiles(e.target.files);
      // Reset input value so same files can be re-selected if desired
      e.target.value = '';
    }
  };

  return (
    <div className="w-full mb-8">
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none group ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-950/30 scale-[1.01] shadow-xl shadow-indigo-500/10'
            : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/70'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Animated Upload Icon */}
          <div
            className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg ${
              isDragOver
                ? 'bg-indigo-600 text-white shadow-indigo-500/30'
                : 'bg-slate-800 border border-slate-700 text-indigo-400 group-hover:bg-indigo-600/20 group-hover:text-indigo-300'
            }`}
          >
            {isUploading ? (
              <div className="h-8 w-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white tracking-tight">
              {isUploading ? 'Streaming & Ingesting Documents...' : 'Drag & Drop files here, or browse from device'}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Batch upload multi-page PDFs (up to 1,000 pages), high-res scanned images, and multi-sheet Excel / CSV files.
            </p>
          </div>

          {/* Format Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20">
              <FileText className="h-3 w-3" />
              <span>PDF (Digital & Scanned)</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <FileSpreadsheet className="h-3 w-3" />
              <span>Excel (.xlsx, .xls) & CSV</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <FileImage className="h-3 w-3" />
              <span>Images (.png, .jpg, .tiff)</span>
            </span>
            <span className="text-xs text-slate-500">Max {MAX_SIZE_MB}MB/file</span>
          </div>
        </div>
      </div>

      {/* Validation Alert */}
      {validationError && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center space-x-2 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span>Need test documents? Run our pre-generated multi-format test suite:</span>
        </div>

        <button
          onClick={onRunSamples}
          disabled={isUploading || isSampleLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSampleLoading ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Running Test Suite (6 Files)...</span>
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" />
              <span>Run Automated Test Suite (6 Files)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
