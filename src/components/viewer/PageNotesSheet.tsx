import React, { useState, useEffect, useRef } from 'react';
import { PageNote } from '../../types';
import { saveNote, deleteNote, getNotesForPage } from '../../services/db';
import { formatDate } from '../../utils/formatters';
import { X, Plus, Trash2, Edit3, Check, StickyNote, AlertTriangle, ArrowLeft } from 'lucide-react';

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

export interface PageNotesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  pageNumber: number;
  initialNotes?: PageNote[];
  onNotesChange?: () => void;
}

interface ColorOption {
  id: NoteColor;
  label: string;
  hex: string;
  swatchClass: string;
  cardClass: string;
  borderClass: string;
  badgeClass: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  {
    id: 'yellow',
    label: 'Yellow',
    hex: '#F59E0B',
    swatchClass: 'bg-amber-400',
    cardClass: 'bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100',
    borderClass: 'border-amber-200 dark:border-amber-800/60',
    badgeClass: 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
  },
  {
    id: 'blue',
    label: 'Blue',
    hex: '#3B82F6',
    swatchClass: 'bg-blue-500',
    cardClass: 'bg-blue-50/90 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100',
    borderClass: 'border-blue-200 dark:border-blue-800/60',
    badgeClass: 'bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200'
  },
  {
    id: 'green',
    label: 'Green',
    hex: '#10B981',
    swatchClass: 'bg-emerald-500',
    cardClass: 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100',
    borderClass: 'border-emerald-200 dark:border-emerald-800/60',
    badgeClass: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
  },
  {
    id: 'pink',
    label: 'Pink',
    hex: '#F43F5E',
    swatchClass: 'bg-rose-400',
    cardClass: 'bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100',
    borderClass: 'border-rose-200 dark:border-rose-800/60',
    badgeClass: 'bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200'
  },
  {
    id: 'purple',
    label: 'Purple',
    hex: '#8B5CF6',
    swatchClass: 'bg-purple-500',
    cardClass: 'bg-purple-50/90 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100',
    borderClass: 'border-purple-200 dark:border-purple-800/60',
    badgeClass: 'bg-purple-200 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200'
  }
];

export const PageNotesSheet: React.FC<PageNotesSheetProps> = ({
  isOpen,
  onClose,
  documentId,
  pageNumber,
  initialNotes,
  onNotesChange
}) => {
  const [pageNotes, setPageNotes] = useState<PageNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<NoteColor>('yellow');
  const [isSaving, setIsSaving] = useState(false);

  // Deletion confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Drag down to close gesture
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Load notes for the current page
  const loadNotes = async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const notes = await getNotesForPage(documentId, pageNumber);
      // Sort newest first
      notes.sort((a, b) => b.updatedAt - a.updatedAt);
      setPageNotes(notes);
    } catch (err) {
      console.error('Failed to load notes for page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialNotes) {
        const filtered = initialNotes.filter((n) => n.pageNumber === pageNumber);
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);
        setPageNotes(filtered);
      } else {
        loadNotes();
      }
      // Reset form
      setIsEditing(false);
      setEditingNoteId(null);
      setTitle('');
      setContent('');
      setSelectedColor('yellow');
      setDeletingId(null);
    }
  }, [isOpen, documentId, pageNumber, initialNotes]);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setSelectedColor('yellow');
    setDeletingId(null);
    setIsEditing(true);
  };

  const handleStartEdit = (note: PageNote) => {
    setEditingNoteId(note.id);
    setTitle(note.title || '');
    setContent(note.content);
    setSelectedColor(note.color);
    setDeletingId(null);
    setIsEditing(true);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingNoteId(null);
    setTitle('');
    setContent('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const now = Date.now();
      const existingNote = editingNoteId ? pageNotes.find((n) => n.id === editingNoteId) : null;

      const noteToSave: PageNote = {
        id: editingNoteId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${now}_${Math.random().toString(36).substring(2, 8)}`),
        documentId,
        pageNumber,
        title: title.trim() || undefined,
        content: content.trim(),
        color: selectedColor,
        createdAt: existingNote ? existingNote.createdAt : now,
        updatedAt: now
      };

      await saveNote(noteToSave);
      await loadNotes();
      onNotesChange?.();
      handleCancelForm();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      setDeletingId(null);
      await loadNotes();
      onNotesChange?.();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Touch gesture to drag down and close
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;
    if (diff > 0) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - dragStartY.current;
    dragStartY.current = null;

    if (diff > 80) {
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(onClose, 150);
    } else {
      sheetRef.current.style.transform = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-[28px] bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 shadow-2xl transition-transform duration-200 ease-out select-text"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {/* iOS Drag Handle */}
        <div
          className="pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            {isEditing ? (
              <button
                type="button"
                onClick={handleCancelForm}
                className="p-1 -ml-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Back to notes list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <StickyNote className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                {isEditing ? (editingNoteId ? 'Edit Note' : 'New Page Note') : `Page ${pageNumber} Notes`}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing
                  ? `Anchored to Page ${pageNumber}`
                  : `${pageNotes.length} ${pageNotes.length === 1 ? 'note' : 'notes'} on this page`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartAdd}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-transform active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close notes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sheet Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
          {isEditing ? (
            /* Add / Edit Note Form */
            <form onSubmit={handleSave} className="space-y-4">
              {/* Color Picker Swatches */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Highlight Color
                </label>
                <div className="flex items-center space-x-3">
                  {COLOR_OPTIONS.map((color) => {
                    const isSelected = selectedColor === color.id;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColor(color.id)}
                        className={`w-9 h-9 rounded-full ${color.swatchClass} flex items-center justify-center transition-transform active:scale-90 ${
                          isSelected ? 'ring-4 ring-offset-2 ring-zinc-400 dark:ring-zinc-600 dark:ring-offset-zinc-900 scale-105' : 'opacity-85 hover:opacity-100'
                        }`}
                        title={color.label}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label htmlFor="note-title" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Title (Optional)
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Key takeaway, Equation, Question..."
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Content Textarea */}
              <div>
                <label htmlFor="note-content" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Note Content *
                </label>
                <textarea
                  id="note-content"
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your notes or insights for this page..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  autoFocus
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold shadow-sm transition-transform active:scale-98 flex items-center justify-center space-x-1.5"
                >
                  <span>{editingNoteId ? 'Update Note' : 'Save Note'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Notes List */
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-zinc-400">Loading notes...</div>
              ) : pageNotes.length === 0 ? (
                /* Empty State */
                <div className="py-10 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-3 shadow-inner">
                    <StickyNote className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    No notes on page {pageNumber}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-1 mb-4 leading-relaxed">
                    Attach sticky annotations, thoughts, or highlights directly to this page.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Note</span>
                  </button>
                </div>
              ) : (
                /* Existing Notes Cards */
                pageNotes.map((note) => {
                  const colorConfig = COLOR_OPTIONS.find((c) => c.id === note.color) || COLOR_OPTIONS[0];
                  const isDeleting = deletingId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`relative rounded-2xl p-4 border transition-all ${colorConfig.cardClass} ${colorConfig.borderClass} shadow-sm`}
                    >
                      {/* Note Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          {note.title ? (
                            <h4 className="text-sm font-semibold truncate leading-tight">
                              {note.title}
                            </h4>
                          ) : (
                            <span className="text-xs font-medium opacity-60 italic">
                              Untitled Note
                            </span>
                          )}
                          <span className="text-[11px] opacity-60 block mt-0.5">
                            {formatDate(note.updatedAt || note.createdAt)}
                          </span>
                        </div>

                        {/* Note Actions */}
                        {!isDeleting && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(note)}
                              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                              title="Edit note"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(note.id)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 opacity-70 hover:opacity-100 hover:bg-rose-500/10 transition-colors"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Note Content */}
                      <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                        {note.content}
                      </p>

                      {/* Inline Delete Confirmation */}
                      {isDeleting && (
                        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs animate-in fade-in duration-200">
                          <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Delete this note?</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(note.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
