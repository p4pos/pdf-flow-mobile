import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  StickyNote, 
  FileText, 
  ArrowUpRight, 
  Trash2, 
  Calendar, 
  Bookmark, 
  Filter,
  Check
} from 'lucide-react';
import { PageNote, PdfDocument } from '../../types';
import { getAllNotes, getAllDocuments, deleteNote } from '../../services/db';
import { formatDate, NOTE_COLORS } from '../../utils/formatters';

export interface AllNotesViewProps {
  onOpenDocument: (documentId: string, pageNumber: number) => void;
  activeTab?: string;
}

type NoteColorFilter = 'all' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

export const AllNotesView: React.FC<AllNotesViewProps> = ({
  onOpenDocument,
}) => {
  const [notes, setNotes] = useState<PageNote[]>([]);
  const [documents, setDocuments] = useState<Record<string, Omit<PdfDocument, 'pdfData'>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<NoteColorFilter>('all');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [noteToDelete, setNoteToDelete] = useState<PageNote | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allNotes, allDocs] = await Promise.all([
        getAllNotes(),
        getAllDocuments(),
      ]);

      // Sort notes newest first
      const sorted = [...allNotes].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setNotes(sorted);

      const docMap: Record<string, Omit<PdfDocument, 'pdfData'>> = {};
      allDocs.forEach((d) => {
        docMap[d.id] = d;
      });
      setDocuments(docMap);
    } catch (err) {
      console.error('Failed to load notes data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setNoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Color filter
      if (selectedColor !== 'all' && note.color !== selectedColor) {
        return false;
      }

      // Document filter
      if (selectedDocId !== 'all' && note.documentId !== selectedDocId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const docTitle = documents[note.documentId]?.title?.toLowerCase() || '';
        const noteTitle = note.title?.toLowerCase() || '';
        const noteContent = note.content.toLowerCase();
        const pageMatch = `page ${note.pageNumber}`.includes(q) || String(note.pageNumber) === q;

        return noteTitle.includes(q) || noteContent.includes(q) || docTitle.includes(q) || pageMatch;
      }

      return true;
    });
  }, [notes, selectedColor, selectedDocId, searchQuery, documents]);

  // Unique document IDs that currently have notes
  const docsWithNotes = useMemo(() => {
    const ids = Array.from(new Set(notes.map((n) => n.documentId)));
    return ids.map((id) => ({
      id,
      title: documents[id]?.title || 'Untitled Document',
    }));
  }, [notes, documents]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50 dark:bg-zinc-950 pb-20 select-none">
      {/* Header Bar */}
      <div className="pt-safe px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200/60 dark:border-zinc-800/80 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <StickyNote className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                All Notes & Annotations
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'} across your library
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-blue-500/40">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, document names, or page numbers..."
            className="w-full bg-transparent border-0 outline-none placeholder:text-gray-400 text-gray-900 dark:text-white text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills (Color and Document filters) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar">
          {/* All Filter Pill */}
          <button
            type="button"
            onClick={() => setSelectedColor('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
              selectedColor === 'all'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            All Colors ({notes.length})
          </button>

          {/* Color Pills */}
          {(['yellow', 'blue', 'green', 'pink', 'purple'] as const).map((colorKey) => {
            const colorDef = NOTE_COLORS[colorKey];
            const isSelected = selectedColor === colorKey;
            const count = notes.filter((n) => n.color === colorKey).length;
            if (count === 0 && selectedColor !== colorKey) return null;

            return (
              <button
                key={colorKey}
                type="button"
                onClick={() => setSelectedColor(isSelected ? 'all' : colorKey)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-white dark:bg-zinc-800 shadow-xs'
                    : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorDef.dot }}
                />
                <span className="capitalize text-gray-700 dark:text-gray-300">
                  {colorKey}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                  ({count})
                </span>
              </button>
            );
          })}

          {/* Document filter dropdown */}
          {docsWithNotes.length > 1 && (
            <div className="relative shrink-0 ml-1">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="py-1 pl-2.5 pr-6 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 outline-none appearance-none"
              >
                <option value="all">All Documents</option>
                {docsWithNotes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Notes List Content */}
      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading notes...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <StickyNote className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {notes.length === 0 ? 'No Notes Created Yet' : 'No Matching Notes'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length === 0
                ? 'Open any PDF document from your library and tap the Note button in the top reader toolbar to anchor sticky notes to specific pages.'
                : 'Try adjusting your search query or color filters to find what you are looking for.'}
            </p>
            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedColor('all');
                  setSelectedDocId('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-gray-200 dark:bg-zinc-800 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-300 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredNotes.map((note) => {
              const doc = documents[note.documentId];
              const docTitle = doc?.title || 'Unknown Document';
              const colorDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

              return (
                <div
                  key={note.id}
                  onClick={() => onOpenDocument(note.documentId, note.pageNumber)}
                  className={`group relative p-4 rounded-2xl border transition-all duration-150 cursor-pointer hover:shadow-md active:scale-[0.99] flex flex-col justify-between ${colorDef.bg} ${colorDef.border}`}
                >
                  {/* Top Bar of Note: Document Name & Page Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {/* Document Info */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 truncate">
                        {docTitle}
                      </span>
                    </div>

                    {/* Page Badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 dark:bg-zinc-800/80 text-gray-700 dark:text-zinc-300 border border-black/5 shadow-2xs">
                        Page {note.pageNumber}
                      </span>
                    </div>
                  </div>

                  {/* Note Title */}
                  {note.title && (
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1 leading-snug">
                      {note.title}
                    </h4>
                  )}

                  {/* Note Content */}
                  <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed line-clamp-4 flex-1">
                    {note.content}
                  </p>

                  {/* Note Card Footer */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-black/5 dark:border-white/5 text-[11px] text-gray-500 dark:text-gray-400">
                    {/* Timestamp */}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 opacity-70" />
                      {formatDate(note.updatedAt || note.createdAt)}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Delete note button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete(note);
                        }}
                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Jump to Page Indicator */}
                      <div className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-700 shadow-xl space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Delete Page Note?
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Are you sure you want to delete this note from Page {noteToDelete.pageNumber}?
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteNote(noteToDelete.id, e)}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
