import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Palette,
  Folder,
  Heart,
  Eye,
  EyeOff,
  Download,
  Trash2,
  X,
  AlertTriangle,
  Check,
  ChevronRight,
  Lock,
  Layers,
  HardDrive
} from 'lucide-react';
import { PdfDocument, DocumentGroup } from '../../types';
import {
  getDocumentBlob,
  updateDocumentMeta,
  deleteDocument,
  getAllGroups
} from '../../services/db';
import { formatFileSize } from '../../utils/formatters';
import { getCoverIcon, resolveGradientClass } from './coverIcons';

export interface DocumentMenuModalProps {
  isOpen: boolean;
  document: PdfDocument | null;
  onClose: () => void;
  onRename?: (doc: PdfDocument) => void;
  onEditCover?: (doc: PdfDocument) => void;
  onChangeGroup?: (doc: PdfDocument) => void;
  onToggleFavorite?: (doc: PdfDocument) => void;
  onToggleVisibility?: (doc: PdfDocument) => void;
  onDownload?: (doc: PdfDocument) => void;
  onDelete?: (doc: PdfDocument) => void;
  onDocumentUpdated?: (doc: PdfDocument) => void;
}

export const DocumentMenuModal: React.FC<DocumentMenuModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onRename,
  onEditCover,
  onChangeGroup,
  onToggleFavorite,
  onToggleVisibility,
  onDownload,
  onDelete,
  onDocumentUpdated,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      setShowGroupPicker(false);
      // Load groups in case inline group change is used
      getAllGroups().then(setGroups).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !doc) return null;

  // Toggle Favorite Handler
  const handleToggleFavorite = () => {
    onToggleFavorite?.(doc);
    onClose();
  };

  // Toggle Hidden Visibility Handler
  const handleToggleVisibility = () => {
    onToggleVisibility?.(doc);
    onClose();
  };

  // Select Group Handler
  const handleSelectGroup = async (groupId: string | undefined) => {
    try {
      await updateDocumentMeta(doc.id, { groupId });
      const updated = { ...doc, groupId };
      onDocumentUpdated?.(updated);
    } catch (e) {
      console.error('Failed to update group:', e);
    }
    setShowGroupPicker(false);
    onClose();
  };

  // Download PDF Handler
  const handleDownload = async () => {
    if (onDownload) {
      onDownload(doc);
      onClose();
      return;
    }

    try {
      setIsDownloading(true);
      let blob = doc.pdfData;
      if (!blob) {
        blob = (await getDocumentBlob(doc.id)) || undefined;
      }

      if (blob) {
        const url = URL.createObjectURL(
          blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' })
        );
        const a = window.document.createElement('a');
        a.href = url;
        a.download = doc.fileName || `${doc.title}.pdf`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to download PDF:', e);
    } finally {
      setIsDownloading(false);
      onClose();
    }
  };

  // Delete Document Handler
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteDocument(doc.id);
      onDelete?.(doc);
    } catch (e) {
      console.error('Failed to delete document:', e);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  // Mini Cover rendering for sheet header
  const renderMiniCover = () => {
    if ((doc.coverType === 'image' || doc.coverType === 'page') && doc.coverData) {
      return (
        <img
          src={doc.coverData}
          alt={doc.title}
          className="w-12 h-16 object-cover rounded-lg shadow-sm border border-black/10 dark:border-white/10 shrink-0"
        />
      );
    }

    const gradientClass = resolveGradientClass(doc.coverColor);
    const IconComp = getCoverIcon(doc.coverData);
    return (
      <div
        className={`w-12 h-16 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shrink-0 shadow-sm border border-white/20`}
      >
        <IconComp className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Action Sheet Container */}
      <div className="relative z-10 w-full max-w-md rounded-t-[28px] sm:rounded-3xl bg-ios-bg dark:bg-black border border-gray-200/60 dark:border-zinc-800/80 shadow-ios-sheet overflow-hidden flex flex-col max-h-[90vh] transition-transform animate-in slide-in-from-bottom duration-250">
        {/* iOS Pull Bar */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header Preview */}
        <div className="flex items-center gap-3.5 p-4 mx-4 mt-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          {renderMiniCover()}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
              {doc.title}
            </h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
              {doc.fileName}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {doc.pageCount} pgs
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {formatFileSize(doc.fileSize)}
              </span>
              {doc.isHidden && (
                <span className="text-amber-500 font-medium flex items-center gap-0.5">
                  • <Lock className="w-2.5 h-2.5" /> Hidden
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* DELETE CONFIRMATION STATE */}
          {showDeleteConfirm ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-rose-200 dark:border-rose-950/60 space-y-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm">Delete Document?</h4>
              </div>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">"{doc.title}"</strong>? This will permanently remove the PDF, its cover, and all attached notes.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          ) : showGroupPicker ? (
            /* GROUP PICKER SUBMENU */
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2 border border-gray-100 dark:border-zinc-800 space-y-1">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Move to Group
                </span>
                <button
                  type="button"
                  onClick={() => setShowGroupPicker(false)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold"
                >
                  Back
                </button>
              </div>

              {/* No Group option */}
              <button
                type="button"
                onClick={() => handleSelectGroup(undefined)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 text-xs font-medium text-gray-700 dark:text-zinc-300 transition-colors"
              >
                <span>None (Unassigned)</span>
                {!doc.groupId && <Check className="w-4 h-4 text-blue-600" />}
              </button>

              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectGroup(g.id)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 text-xs font-medium text-gray-700 dark:text-zinc-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span>{g.name}</span>
                  </div>
                  {doc.groupId === g.id && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            /* STANDARD ACTIONS LIST */
            <>
              {/* Group 1: Appearance & Metadata */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    onRename?.(doc);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Rename Document</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onEditCover?.(doc);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Edit Cover & Theme</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onChangeGroup) {
                      onChangeGroup(doc);
                    } else {
                      setShowGroupPicker(true);
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span>Change Group</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Group 2: Favorites, Visibility, Export */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart
                      className={`w-4 h-4 ${
                        doc.isFavorite
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-gray-400 dark:text-zinc-400'
                      }`}
                    />
                    <span>
                      {doc.isFavorite
                        ? 'Remove from Favorites'
                        : 'Add to Favorites'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {doc.isHidden ? (
                      <>
                        <Eye className="w-4 h-4 text-emerald-500" />
                        <span>Show in Library</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 text-zinc-500" />
                        <span>Hide from Library</span>
                      </>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={handleDownload}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/80 active:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>
                      {isDownloading ? 'Downloading...' : 'Download / Export PDF'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Group 3: Destructive Action */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Document</span>
                </button>
              </div>
            </>
          )}

          {/* iOS Cancel Button */}
          <div className="pt-1 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-white dark:bg-zinc-900 text-sm font-bold text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-zinc-800 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
