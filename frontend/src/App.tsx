import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { UploadBanner } from './components/UploadBanner';
import { SummaryCards } from './components/SummaryCards';
import { DocumentList } from './components/DocumentList';
import { DocumentDetailPanel } from './components/DocumentDetailPanel';
import { SystemMetricsModal } from './components/SystemMetricsModal';
import { CompareModal } from './components/CompareModal';
import {
  clearAllDocuments,
  deleteDocument,
  fetchDocuments,
  runSampleDocuments,
  uploadDocuments,
} from './services/api';
import type { DocumentResponse } from './types/document';

export const App: React.FC = () => {
  // All documents currently in database (used for top summary cards and compare)
  const [allDocs, setAllDocs] = useState<DocumentResponse[]>([]);
  // Documents currently displayed in the list (may be filtered or searched)
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Search & Filter state (Hybrid search automatically runs keyword + semantic behind the scenes)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'needs_review' | 'failed'>('all');

  // Loading & Modal state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  // Debounce timer ref for search input
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load documents from SQLite persistence
  const loadDocumentsFromDb = useCallback(
    async (query = searchQuery, status = activeFilter) => {
      setIsSearching(true);
      try {
        const fetched = await fetchDocuments({
          q: query.trim() || undefined,
          mode: 'hybrid',
          status: status !== 'all' ? status : undefined,
        });
        setDocuments(fetched);

        // Fetch unfiltered documents for top summary metrics
        if (!query && status === 'all') {
          setAllDocs(fetched);
        }

        // Keep current selected doc if still in list, or select first
        if (fetched.length > 0) {
          setSelectedDocId((prev) => {
            const exists = fetched.some((d) => d.file_id === prev);
            return exists ? prev : fetched[0].file_id;
          });
        }
      } catch (err) {
        console.error('Failed to load documents from database:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, activeFilter]
  );

  // Initial load on mount
  useEffect(() => {
    loadDocumentsFromDb();
  }, []);

  // Debounced hybrid search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadDocumentsFromDb(searchQuery, activeFilter);
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, activeFilter, loadDocumentsFromDb]);

  // Handle User Uploading Files
  const handleFilesSelected = async (files: File[]) => {
    setIsUploading(true);
    try {
      const res = await uploadDocuments(files);
      await loadDocumentsFromDb('', 'all');
      if (res.documents.length > 0) {
        setSelectedDocId(res.documents[0].file_id);
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Loading 5 Bangladeshi BDT Demo Invoices
  const handleLoadSamples = async () => {
    setIsLoadingSamples(true);
    try {
      const res = await runSampleDocuments();
      setDocuments(res.documents);
      setAllDocs(res.documents);
      setSearchQuery('');
      setActiveFilter('all');
      if (res.documents.length > 0) {
        setSelectedDocId(res.documents[0].file_id);
      }
    } catch (err) {
      console.error('Sample run error:', err);
      alert(`Failed to load demo invoices: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  // Callback when a document is manually corrected or reprocessed
  const handleDocumentUpdated = (updatedDoc: DocumentResponse) => {
    setDocuments((prev) =>
      prev.map((d) => (d.file_id === updatedDoc.file_id ? updatedDoc : d))
    );
    setAllDocs((prev) =>
      prev.map((d) => (d.file_id === updatedDoc.file_id ? updatedDoc : d))
    );
  };

  // Handle deleting individual document
  const handleDeleteDocument = async (fileId: string) => {
    try {
      await deleteDocument(fileId);
      const remainingDocs = documents.filter((d) => d.file_id !== fileId);
      const remainingAllDocs = allDocs.filter((d) => d.file_id !== fileId);
      setDocuments(remainingDocs);
      setAllDocs(remainingAllDocs);

      if (selectedDocId === fileId) {
        setSelectedDocId(remainingDocs.length > 0 ? remainingDocs[0].file_id : null);
      }
    } catch (err) {
      console.error('Delete document failed:', err);
      alert(`Failed to delete document: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle clearing all documents
  const handleClearAllDocuments = async () => {
    try {
      await clearAllDocuments();
      setDocuments([]);
      setAllDocs([]);
      setSelectedDocId(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Clear all documents failed:', err);
      alert(`Failed to clear documents: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Currently selected document
  const selectedDoc = documents.find((d) => d.file_id === selectedDocId) || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. Clean Top Navbar */}
      <Navbar
        onOpenMetrics={() => setIsMetricsModalOpen(true)}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onLoadSamples={handleLoadSamples}
        isLoadingSamples={isLoadingSamples}
        onClearAll={handleClearAllDocuments}
      />

      {/* Task 7: Accuracy Report Modal */}
      <SystemMetricsModal
        isOpen={isMetricsModalOpen}
        onClose={() => setIsMetricsModalOpen(false)}
      />

      {/* Cross-Check & Compare Modal */}
      <CompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        documents={allDocs.length > 0 ? allDocs : documents}
      />

      {/* 2. Main Split-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Upload Banner with 3-Step Guide */}
        <UploadBanner onFilesSelected={handleFilesSelected} isUploading={isUploading} />

        {/* 4 Plain-English Summary Cards */}
        <SummaryCards
          documents={allDocs.length > 0 ? allDocs : documents}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />

        {/* Split-Screen Workspace (Left: Document List & Search, Right: Inspection Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (40% width) - Document List with Single Smart Search Box */}
          <div className="lg:col-span-5 w-full">
            <DocumentList
              documents={documents}
              selectedDocId={selectedDocId}
              onSelectDoc={(doc) => setSelectedDocId(doc.file_id)}
              activeFilter={activeFilter}
              onSelectFilter={setActiveFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isSearching={isSearching}
              onDeleteDoc={handleDeleteDocument}
              onClearAll={handleClearAllDocuments}
            />
          </div>

          {/* Right Column (60% width) - Detail Inspection Panel */}
          <div className="lg:col-span-7 w-full sticky top-20">
            <DocumentDetailPanel
              document={selectedDoc}
              onDocumentUpdated={handleDocumentUpdated}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        </div>
      </main>

      {/* Clean Light Footer */}
      <footer className="border-t border-slate-200/80 py-4 mt-10 bg-white text-center text-xs text-slate-400">
        DocuIntellect • AI Document Intelligence & Verification System (BDT ৳)
      </footer>
    </div>
  );
};

export default App;
