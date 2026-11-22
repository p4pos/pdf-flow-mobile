import React, { useEffect, useState } from 'react';
import { X, StickyNote, ChevronRight, Calendar } from 'lucide-react';
import { PdfDocument, PageNote } from '../../types';
import { getNotesForDocument } from '../../services/db';
import { formatDate, NOTE_COLORS } from '../../utils/formatters';

export interface NotesPreviewModalProps {
  isOpen: boolean;
  document: PdfDocument | null;
  onClose: () => void;
  onNavigateToPage?: (doc: PdfDocument, pageNumber: number) => void;
}

export const NotesPreviewModal: React.FC<NotesPreviewModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onNavigateToPage,
}) => {
  const [notes, setNotes] = useState<PageNote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && doc) {
      setLoading(true);
      getNotesForDocument(doc.id)
        .then((fetched) => {
          // Sort by page number then created date
          const sorted = [...fetched].sort((a, b) => {
            if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
            return a.createdAt - b.createdAt;
          });
          setNotes(sorted);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-[28px] sm:rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <StickyNote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                In-Page Notes
              </h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 truncate max-w-[260px]">
                {doc.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 animate-pulse">
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <StickyNote className="w-10 h-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">
                No notes found
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs">
                Open this PDF in the reader and tap the Note button to add annotations to any page.
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (onNavigateToPage) {
                      onClose();
                      onNavigateToPage(doc, note.pageNumber);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border ${colorConfig.border} ${colorConfig.bg} transition-transform active:scale-[0.99] cursor-pointer shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: colorConfig.dot }}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-zinc-200">
                        Page {note.pageNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400">
                      <Calendar className="w-3 h-3 opacity-60" />
                      <span>{formatDate(note.createdAt)}</span>
                      {onNavigateToPage && (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-1" />
                      )}
                    </div>
                  </div>

                  {note.title && (
                    <h5 className="font-semibold text-xs text-gray-900 dark:text-zinc-100 mb-1">
                      {note.title}
                    </h5>
                  )}

                  <p className="text-xs text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900 flex justify-end pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
