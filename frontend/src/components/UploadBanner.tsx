import React, { useRef, useState } from 'react';
import { UploadCloud, FileUp, AlertCircle, ArrowRight } from 'lucide-react';

interface UploadBannerProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

const SUPPORTED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.xlsx', '.xls', '.csv'];
const MAX_SIZE_MB = 50;

export const UploadBanner: React.FC<UploadBannerProps> = ({ onFilesSelected, isUploading }) => {
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

    Array.from(files).forEach((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) {
        invalidFiles.push(file.name);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setValidationError(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`);
        return;
      }
      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      setValidationError(`Unsupported format: ${invalidFiles.join(', ')}. Use PDF, Excel, CSV, or Image.`);
      return;
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
      e.target.value = '';
    }
  };

  return (
    <div className="mb-5">
      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 sm:p-5 transition-all cursor-pointer select-none bg-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
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

        {/* Left: Icon & Text */}
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            {isUploading ? (
              <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-900">
                {isUploading ? 'Processing uploaded documents...' : 'Upload invoices or documents'}
              </span>
              <span className="hidden md:inline-block text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                PDF • Excel • CSV • Images
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Drag and drop files here, or click to choose from your device (up to 50MB)
            </p>
          </div>
        </div>

        {/* Right: Upload Action Button */}
        <button
          type="button"
          disabled={isUploading}
          className="shrink-0 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <FileUp className="h-4 w-4" />
          <span>Select Files</span>
        </button>
      </div>

      {validationError && (
        <div className="mt-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center space-x-2 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* How to Use (3 Easy Steps) Strip */}
      <div className="mt-3 py-2.5 px-4 bg-white border border-slate-200/90 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xs text-xs">
        <div className="flex items-center space-x-2 text-slate-700">
          <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
            1
          </span>
          <span className="font-medium">Upload PDF / Excel / Image</span>
        </div>

        <ArrowRight className="hidden sm:inline h-3.5 w-3.5 text-slate-400" />

        <div className="flex items-center space-x-2 text-slate-700">
          <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px]">
            2
          </span>
          <span className="font-medium">AI checks BDT (৳) amounts & finds mistakes</span>
        </div>

        <ArrowRight className="hidden sm:inline h-3.5 w-3.5 text-slate-400" />

        <div className="flex items-center space-x-2 text-slate-700">
          <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">
            3
          </span>
          <span className="font-medium">Click "Fix Now" to correct any wrong invoice</span>
        </div>
      </div>
    </div>
  );
};
