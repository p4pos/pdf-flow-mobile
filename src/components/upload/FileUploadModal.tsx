import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Folder, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Trash2,
  Plus
} from 'lucide-react';
import { DocumentGroup, PdfDocument } from '../../types';
import { getAllGroups, saveDocument } from '../../services/db';
import { createSamplePdf, generateCoverThumbnail } from '../../services/pdfService';
import { formatFileSize } from '../../utils/formatters';

export interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentAdded?: (documentId: string) => void;
  defaultGroupId?: string;
}

interface QueuedFile {
  id: string;
  file: File;
  title: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDocumentAdded,
  defaultGroupId,
}) => {
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(defaultGroupId || '');
  const [isPrivateVault, setIsPrivateVault] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [filesQueue, setFilesQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSampleLoading, setIsSampleLoading] = useState<boolean>(false);
  const [overallError, setOverallError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available groups
  useEffect(() => {
    if (isOpen) {
      getAllGroups().then((loaded) => {
        setGroups(loaded);
      }).catch(console.error);

      setSelectedGroupId(defaultGroupId || '');
      setIsPrivateVault(false);
      setFilesQueue([]);
      setIsProcessing(false);
      setIsSampleLoading(false);
      setOverallError('');
    }
  }, [isOpen, defaultGroupId]);

  const addFilesToQueue = (fileList: FileList | File[]) => {
    const pdfFiles = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      setOverallError('Please select valid PDF files (.pdf)');
      return;
    }

    setOverallError('');
    const newItems: QueuedFile[] = pdfFiles.map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      file,
      title: file.name.replace(/\.pdf$/i, '').trim(),
      status: 'idle',
    }));

    setFilesQueue((prev) => [...prev, ...newItems]);
  };

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    setFilesQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setFilesQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  // Instant Sample PDF Generation
  const handleTrySample = async () => {
    if (isSampleLoading || isProcessing) return;
    setIsSampleLoading(true);
    setOverallError('');

    try {
      const sampleBlob = createSamplePdf(
        'Welcome to PDF Flow Guide',
        'Mobile PDF Reader & Vault',
        3
      );

      // Extract cover thumbnail
      const { thumbnailDataUrl, pageCount } = await generateCoverThumbnail(sampleBlob);

      const docId = `sample_${Date.now()}`;
      const sampleDoc: PdfDocument = {
        id: docId,
        title: 'Welcome to PDF Flow Guide',
        fileName: 'Welcome_to_PDF_Flow_Guide.pdf',
        fileSize: sampleBlob.size,
        pageCount: pageCount || 3,
        dateAdded: Date.now(),
        coverType: thumbnailDataUrl ? 'page' : 'gradient',
        coverData: thumbnailDataUrl,
        coverColor: 'from-blue-600 via-indigo-600 to-sky-500',
        groupId: selectedGroupId || undefined,
        isFavorite: true,
        isHidden: isPrivateVault,
        tags: ['Guide', 'Sample'],
      };

      await saveDocument(sampleDoc, sampleBlob);

      onDocumentAdded?.(docId);
      onClose();
    } catch (err: any) {
      console.error('Failed to create sample PDF:', err);
      setOverallError('Failed to generate sample PDF. Please try again.');
    } finally {
      setIsSampleLoading(false);
    }
  };

  // Process & Upload Queued Files
  const handleStartImport = async () => {
    if (filesQueue.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setOverallError('');

    let firstUploadedDocId = '';

    for (let i = 0; i < filesQueue.length; i++) {
      const item = filesQueue[i];
      if (item.status === 'done') continue;

      // Update item status to processing
      setFilesQueue((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'processing' } : it))
      );

      try {
        const file = item.file;
        const { thumbnailDataUrl, pageCount } = await generateCoverThumbnail(file);

        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (!firstUploadedDocId) firstUploadedDocId = docId;

        const newDoc: PdfDocument = {
          id: docId,
          title: item.title.trim() || file.name.replace(/\.pdf$/i, ''),
          fileName: file.name,
          fileSize: file.size,
          pageCount: pageCount || 1,
          dateAdded: Date.now(),
          coverType: thumbnailDataUrl ? 'page' : 'gradient',
          coverData: thumbnailDataUrl,
          coverColor: 'from-blue-600 to-indigo-600',
          groupId: selectedGroupId || undefined,
          isFavorite: false,
          isHidden: isPrivateVault,
          tags: [],
        };

        await saveDocument(newDoc, file);

        // Update item to done
        setFilesQueue((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'done' } : it))
        );
      } catch (err: any) {
        console.error(`Failed to process ${item.file.name}:`, err);
        setFilesQueue((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'error', error: 'Failed to process PDF' } : it
          )
        );
      }
    }

    setIsProcessing(false);

    if (firstUploadedDocId) {
      onDocumentAdded?.(firstUploadedDocId);
      setTimeout(() => {
        onClose();
      }, 400);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Surface */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        className="glass-modal relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-200"
      >
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <UploadCloud className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                Import PDF Documents
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add to your offline library with auto-cover generation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Quick Demo: "Try Sample PDF" Action Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                  <span>Welcome to PDF Flow Guide</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                    Sample
                  </span>
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  3-page interactive demo to test reader & notes
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTrySample}
              disabled={isSampleLoading || isProcessing}
              className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
            >
              {isSampleLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Try Sample</span>
                </>
              )}
            </button>
          </div>

          {/* Drag & Drop Target Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[0.99]'
                : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 bg-gray-50/50 dark:bg-zinc-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
              <UploadCloud className="w-6 h-6 stroke-[2]" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Tap to browse or drop PDF files
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Supports multiple files (.pdf)
            </p>
          </div>

          {/* Group and Privacy Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Group Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Assign to Group
              </label>
              <div className="relative">
                <Folder className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs text-gray-900 dark:text-white font-medium border border-transparent focus:border-blue-500 outline-none appearance-none"
                >
                  <option value="">None (Unorganized)</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Privacy Vault Toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Privacy Vault
              </label>
              <button
                type="button"
                onClick={() => setIsPrivateVault(!isPrivateVault)}
                className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                  isPrivateVault
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                    : 'bg-gray-100 dark:bg-zinc-800 border-transparent text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Hidden in Vault</span>
                </span>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isPrivateVault ? 'bg-amber-500 text-white' : 'bg-gray-300 dark:bg-zinc-600 text-transparent'
                }`}>
                  ✓
                </span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {overallError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{overallError}</span>
            </div>
          )}

          {/* Queue of Selected Files */}
          {filesQueue.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
                <span>Selected Files ({filesQueue.length})</span>
                <button
                  type="button"
                  onClick={() => setFilesQueue([])}
                  disabled={isProcessing}
                  className="text-red-500 hover:text-red-600 text-[11px]"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {filesQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateTitle(item.id, e.target.value)}
                        disabled={isProcessing}
                        placeholder="Document title"
                        className="w-full bg-transparent font-semibold text-gray-900 dark:text-white outline-none border-b border-transparent focus:border-blue-500 truncate text-xs"
                      />
                      <span className="text-[11px] text-gray-400">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    {/* Status / Remove Action */}
                    <div className="shrink-0">
                      {item.status === 'processing' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : item.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : item.status === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          disabled={isProcessing}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartImport}
            disabled={filesQueue.length === 0 || isProcessing}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing & Processing...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Import ({filesQueue.length} {filesQueue.length === 1 ? 'file' : 'files'})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
