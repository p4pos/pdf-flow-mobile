import React, { useState, useEffect, useRef } from 'react';
import { X, Tag, Plus, Check, RefreshCw, Edit3 } from 'lucide-react';
import { PdfDocument } from '../../types';
import { updateDocumentMeta } from '../../services/db';

export interface RenameModalProps {
  isOpen: boolean;
  document: PdfDocument | null;
  onClose: () => void;
  onSave?: (id: string, newTitle: string, newTags: string[]) => Promise<void> | void;
  onDocumentUpdated?: (updatedDoc: PdfDocument) => void;
}

const SUGGESTED_TAGS = [
  'Important',
  'Work',
  'Study',
  'Finance',
  'Receipt',
  'Invoice',
  'Personal',
  'Reference',
  'Manual',
  'Draft'
];

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onSave,
  onDocumentUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && doc) {
      setTitle(doc.title || '');
      setTags(doc.tags ? [...doc.tags] : []);
      setTagInput('');
      setErrorMsg(null);
      // Focus input after render
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleAddTag = (tagToAdd?: string) => {
    const rawTag = tagToAdd || tagInput;
    const cleanTag = rawTag.trim().replace(/^#/, '');
    if (!cleanTag) return;

    if (tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
      setTagInput('');
      return;
    }

    setTags([...tags, cleanTag]);
    setTagInput('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Document title cannot be empty.');
      titleInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await updateDocumentMeta(doc.id, {
        title: cleanTitle,
        tags,
      });

      const updated: PdfDocument = {
        ...doc,
        title: cleanTitle,
        tags,
      };

      if (onSave) {
        await onSave(doc.id, cleanTitle, tags);
      }
      onDocumentUpdated?.(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update document title.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Rename & Tags
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {errorMsg}
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="doc-title-input"
              className="text-xs font-semibold text-gray-700 dark:text-zinc-300"
            >
              Document Title
            </label>
            <div className="relative">
              <input
                id="doc-title-input"
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Report 2024"
                className="w-full px-3.5 py-3 pr-10 text-sm font-medium rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-400 transition-all"
              />
              {title.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTitle('');
                    titleInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
              Original file: {doc.fileName}
            </p>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              <span>Tags & Labels</span>
            </label>

            {/* Current Tags Chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/80">
              {tags.length === 0 ? (
                <span className="text-xs text-gray-400 dark:text-zinc-500 italic p-0.5">
                  No tags added yet.
                </span>
              ) : (
                tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="p-0.5 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Tag Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDownTag}
                placeholder="Type tag and press Enter..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                disabled={!tagInput.trim()}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-200 dark:bg-zinc-700 hover:bg-blue-600 hover:text-white text-gray-700 dark:text-zinc-300 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Suggested Tags */}
            <div className="pt-1">
              <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 block mb-1">
                Suggested tags:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.map((suggested) => {
                  const isAdded = tags.some(
                    (t) => t.toLowerCase() === suggested.toLowerCase()
                  );
                  return (
                    <button
                      key={suggested}
                      type="button"
                      onClick={() => handleAddTag(suggested)}
                      disabled={isAdded}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                        isAdded
                          ? 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600 cursor-default'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-300'
                      }`}
                    >
                      +{suggested}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
