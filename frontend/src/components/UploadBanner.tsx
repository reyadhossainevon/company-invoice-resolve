import React, { useRef, useState } from 'react';
import { UploadCloud, FileUp, AlertCircle, ArrowRight } from 'lucide-react';

interface UploadBannerProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

const SUPPORTED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.xlsx', '.xls', '.csv'];
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
    <div className="mb-6">
      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 transition-all cursor-pointer select-none bg-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/90'
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
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
            {isUploading ? (
              <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-base font-bold text-slate-900">
                {isUploading ? 'Processing uploaded documents...' : 'Upload invoices or documents'}
              </span>
              <span className="hidden md:inline-block text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                PDF • Excel • CSV • Images
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              Drag and drop files here, or click to choose from your device (up to 50MB)
            </p>
          </div>
        </div>

        {/* Right: Upload Action Button */}
        <button
          type="button"
          disabled={isUploading}
          className="shrink-0 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
        >
          <FileUp className="h-4.5 w-4.5" />
          <span>Select Files</span>
        </button>
      </div>

      {validationError && (
        <div className="mt-3 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2.5 text-sm font-semibold text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* How to Use (3 Easy Steps) Strip */}
      <div className="mt-3 py-3 px-5 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs text-sm">
        <div className="flex items-center space-x-2.5 text-slate-800">
          <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
            1
          </span>
          <span className="font-semibold">Upload PDF / Excel / Image</span>
        </div>

        <ArrowRight className="hidden sm:inline h-4 w-4 text-slate-400" />

        <div className="flex items-center space-x-2.5 text-slate-800">
          <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
            2
          </span>
          <span className="font-semibold">AI checks BDT (৳) amounts & finds mistakes</span>
        </div>

        <ArrowRight className="hidden sm:inline h-4 w-4 text-slate-400" />

        <div className="flex items-center space-x-2.5 text-slate-800">
          <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
            3
          </span>
          <span className="font-semibold">Click "Fix Now" to correct any wrong invoice</span>
        </div>
      </div>
    </div>
  );
};