import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  StickyNote, 
  FileText, 
  ArrowUpRight, 
  Trash2, 
  Calendar, 
  ChevronDown, 
  BookOpen, 
  Search, 
  X,
  RotateCcw
} from 'lucide-react';
import { PageNote, PdfDocument, ViewMode } from '../../types';
import { getAllNotes, getAllDocuments, deleteNote } from '../../services/db';
import { formatDate } from '../../utils/formatters';

export interface AllNotesViewProps {
  onOpenDocument: (documentId: string, pageNumber: number) => void;
  onSwitchToLibrary?: () => void;
  onNotesChanged?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  viewMode?: ViewMode;
  activeTab?: string;
  className?: string;
}

type NoteColorFilter = 'all' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

interface ColorMeta {
  name: string;
  dot: string;
  cardBg: string;
  cardBorder: string;
  accentBar: string;
  pillActive: string;
}

const COLOR_CONFIG: Record<'yellow' | 'blue' | 'green' | 'pink' | 'purple', ColorMeta> = {
  yellow: {
    name: 'Yellow',
    dot: '#F59E0B',
    cardBg: 'bg-amber-50/75 dark:bg-amber-950/25',
    cardBorder: 'border-amber-200/80 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700/60',
    accentBar: 'bg-amber-500 dark:bg-amber-400',
    pillActive: 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30',
  },
  blue: {
    name: 'Blue',
    dot: '#3B82F6',
    cardBg: 'bg-sky-50/75 dark:bg-sky-950/25',
    cardBorder: 'border-sky-200/80 dark:border-sky-800/40 hover:border-sky-300 dark:hover:border-sky-700/60',
    accentBar: 'bg-blue-500 dark:bg-blue-400',
    pillActive: 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-500/30',
  },
  green: {
    name: 'Green',
    dot: '#10B981',
    cardBg: 'bg-emerald-50/75 dark:bg-emerald-950/25',
    cardBorder: 'border-emerald-200/80 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700/60',
    accentBar: 'bg-emerald-500 dark:bg-emerald-400',
    pillActive: 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30',
  },
  pink: {
    name: 'Pink',
    dot: '#F43F5E',
    cardBg: 'bg-rose-50/75 dark:bg-rose-950/25',
    cardBorder: 'border-rose-200/80 dark:border-rose-800/40 hover:border-rose-300 dark:hover:border-rose-700/60',
    accentBar: 'bg-rose-500 dark:bg-rose-400',
    pillActive: 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-500/30',
  },
  purple: {
    name: 'Purple',
    dot: '#8B5CF6',
    cardBg: 'bg-purple-50/75 dark:bg-purple-950/25',
    cardBorder: 'border-purple-200/80 dark:border-purple-800/40 hover:border-purple-300 dark:hover:border-purple-700/60',
    accentBar: 'bg-purple-500 dark:bg-purple-400',
    pillActive: 'bg-purple-500 text-white shadow-sm ring-2 ring-purple-500/30',
  },
};

/**
 * Apple-style Warm Notebook Illustration for the empty state
 */
const WarmNotebookIllustration: React.FC = () => (
  <div className="relative w-32 h-32 mx-auto flex items-center justify-center select-none">
    {/* Soft warm ambient halo */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400/25 to-yellow-300/20 dark:from-amber-500/15 dark:to-yellow-400/10 blur-2xl scale-125 pointer-events-none" />

    {/* Vector Notebook */}
    <svg
      viewBox="0 0 120 120"
      className="w-28 h-28 drop-shadow-md relative z-10 transition-transform duration-300 hover:scale-105"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Soft Drop Shadow Layer */}
      <rect x="24" y="24" width="72" height="78" rx="14" fill="#000000" fillOpacity="0.08" />

      {/* Under Stacked Pages */}
      <rect x="22" y="22" width="72" height="76" rx="12" fill="#E2E8F0" className="dark:fill-zinc-700" />
      <rect x="24" y="20" width="72" height="76" rx="12" fill="#F1F5F9" className="dark:fill-zinc-600" />

      {/* Main Warm Notebook Cover */}
      <rect
        x="26"
        y="18"
        width="70"
        height="76"
        rx="12"
        fill="url(#appleNotebookGrad)"
        stroke="#D97706"
        strokeWidth="1.2"
        strokeOpacity="0.25"
      />

      {/* Warm Leather Spine / Binding Band */}
      <path
        d="M26 30C26 23.3726 31.3726 18 38 18H41V94H38C31.3726 94 26 88.6274 26 82V30Z"
        fill="#D97706"
        fillOpacity="0.85"
      />

      {/* Spine Rings */}
      <circle cx="34" cy="30" r="1.8" fill="#FEF3C7" />
      <circle cx="34" cy="44" r="1.8" fill="#FEF3C7" />
      <circle cx="34" cy="58" r="1.8" fill="#FEF3C7" />
      <circle cx="34" cy="72" r="1.8" fill="#FEF3C7" />
      <circle cx="34" cy="84" r="1.8" fill="#FEF3C7" />

      {/* Inset Ruled Notepad Paper */}
      <rect
        x="45"
        y="25"
        width="45"
        height="62"
        rx="6"
        fill="#FFFFFF"
        className="dark:fill-zinc-800"
        fillOpacity="0.95"
      />

      {/* Ruled lines */}
      <line x1="50" y1="36" x2="84" y2="36" stroke="#CBD5E1" className="dark:stroke-zinc-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="46" x2="84" y2="46" stroke="#CBD5E1" className="dark:stroke-zinc-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="56" x2="78" y2="56" stroke="#CBD5E1" className="dark:stroke-zinc-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="66" x2="82" y2="66" stroke="#CBD5E1" className="dark:stroke-zinc-600" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="76" x2="74" y2="76" stroke="#CBD5E1" className="dark:stroke-zinc-600" strokeWidth="1.5" strokeLinecap="round" />

      {/* Amber Ribbon Bookmark */}
      <path
        d="M62 18V40L68 35L74 40V18H62Z"
        fill="#F59E0B"
        filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.2))"
      />

      {/* Stylus / Pencil Accent */}
      <g transform="rotate(-32 78 74)">
        <rect x="73" y="46" width="7" height="38" rx="2" fill="#3B82F6" />
        <path d="M73 46L76.5 38L80 46H73Z" fill="#FBBF24" />
        <circle cx="76.5" cy="38" r="1" fill="#1E293B" />
        <rect x="73" y="80" width="7" height="4" rx="1" fill="#F43F5E" />
      </g>

      <defs>
        <linearGradient id="appleNotebookGrad" x1="26" y1="18" x2="96" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7" />
          <stop offset="1" stopColor="#FDE68A" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

export const AllNotesView: React.FC<AllNotesViewProps> = ({
  onOpenDocument,
  onSwitchToLibrary,
  onNotesChanged,
  searchQuery = '',
  onSearchChange,
  viewMode = 'grid',
  className = '',
}) => {
  const [notes, setNotes] = useState<PageNote[]>([]);
  const [documents, setDocuments] = useState<Record<string, Omit<PdfDocument, 'pdfData'>>>({});
  const [selectedColor, setSelectedColor] = useState<NoteColorFilter>('all');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [noteToDelete, setNoteToDelete] = useState<PageNote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setNoteToDelete(null);
      onNotesChanged?.();
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Color counts computation
  const colorCounts = useMemo(() => {
    const counts: Record<'yellow' | 'blue' | 'green' | 'pink' | 'purple', number> = {
      yellow: 0,
      blue: 0,
      green: 0,
      pink: 0,
      purple: 0,
    };
    for (const note of notes) {
      if (counts[note.color] !== undefined) {
        counts[note.color]++;
      }
    }
    return counts;
  }, [notes]);

  // Unique document IDs that currently have notes
  const docsWithNotes = useMemo(() => {
    const ids = Array.from(new Set(notes.map((n) => n.documentId)));
    return ids.map((id) => ({
      id,
      title: documents[id]?.title || 'Untitled Document',
    }));
  }, [notes, documents]);

  // Filter notes based on global search, color, and document
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

      // Search query (from top Header)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const docTitle = documents[note.documentId]?.title?.toLowerCase() || '';
        const noteTitle = note.title?.toLowerCase() || '';
        const noteContent = note.content.toLowerCase();
        const pageMatch =
          `page ${note.pageNumber}`.includes(q) ||
          `p. ${note.pageNumber}`.includes(q) ||
          `p${note.pageNumber}`.includes(q) ||
          String(note.pageNumber) === q;

        return noteTitle.includes(q) || noteContent.includes(q) || docTitle.includes(q) || pageMatch;
      }

      return true;
    });
  }, [notes, selectedColor, selectedDocId, searchQuery, documents]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedColor !== 'all' || selectedDocId !== 'all'
  );

  const resetFilters = () => {
    onSearchChange?.('');
    setSelectedColor('all');
    setSelectedDocId('all');
  };

  return (
    <div className={`w-full flex flex-col select-none ${className}`}>
      {/* Category Header: Sleek Apple Title & Subtitle */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs shrink-0">
            <StickyNote className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              Notes & Annotations
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
              {isLoading
                ? 'Loading notebook...'
                : hasActiveFilters
                ? `Showing ${filteredNotes.length} of ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
                : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} across your library`}
            </p>
          </div>
        </div>

        {/* Quick Reset Filter Pill when any filter is active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-400/15 transition-all active:scale-95"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3 stroke-[2.2]" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Horizontal Filter Bar: All Notes, Color Dots with Counts, Document Filter */}
      {!isLoading && notes.length > 0 && (
        <div
          className="w-full overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-4"
          role="region"
          aria-label="Notes Filters"
        >
          <div className="flex items-center space-x-2 min-w-max">
            {/* "All Notes" Primary Pill */}
            <button
              type="button"
              onClick={() => setSelectedColor('all')}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 shrink-0 ${
                selectedColor === 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-600/30'
                  : 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.05] dark:border-white/[0.06]'
              }`}
              aria-pressed={selectedColor === 'all'}
            >
              <span>All Notes</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                  selectedColor === 'all'
                    ? 'bg-white/25 text-white'
                    : 'bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                }`}
              >
                {notes.length}
              </span>
            </button>

            {/* Dynamic Color Chips: Displayed only when count > 0 */}
            {(['yellow', 'blue', 'green', 'pink', 'purple'] as const).map((colorKey) => {
              const count = colorCounts[colorKey] || 0;
              const isSelected = selectedColor === colorKey;

              // Only show when count > 0 OR if this color is currently active
              if (count === 0 && !isSelected) return null;

              const config = COLOR_CONFIG[colorKey];

              return (
                <button
                  key={colorKey}
                  type="button"
                  onClick={() => setSelectedColor(isSelected ? 'all' : colorKey)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 shrink-0 ${
                    isSelected
                      ? config.pillActive
                      : 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.05] dark:border-white/[0.06]'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: config.dot }}
                  />
                  <span>{config.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Document Selector Dropdown Chip (only shown when 2+ documents have notes) */}
            {docsWithNotes.length > 1 && (
              <div className="relative shrink-0 flex items-center">
                <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-3 pointer-events-none stroke-[2]" />
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className={`h-8 pl-8 pr-7 rounded-full text-xs font-semibold transition-all duration-150 appearance-none cursor-pointer outline-none border ${
                    selectedDocId !== 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border-black/[0.05] dark:border-white/[0.06]'
                  }`}
                  aria-label="Filter notes by document"
                >
                  <option value="all" className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                    All Documents ({docsWithNotes.length})
                  </option>
                  {docsWithNotes.map((d) => (
                    <option key={d.id} value={d.id} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
                      {d.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`w-3.5 h-3.5 absolute right-2.5 pointer-events-none stroke-[2.2] ${
                    selectedDocId !== 'all' ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-4 py-2 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Loading notebook...</p>
          </div>
        ) : notes.length === 0 ? (
          /* EMPTY STATE 1: Zero notes exist across library */
          <div className="py-12 px-6 max-w-sm mx-auto text-center animate-in fade-in duration-300">
            <WarmNotebookIllustration />

            <h3 className="text-base font-bold text-gray-900 dark:text-white mt-4">
              Your Notebook is Empty
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Open any PDF from your library and tap the note icon on any page to anchor notes and annotations.
            </p>

            {onSwitchToLibrary && (
              <button
                type="button"
                onClick={onSwitchToLibrary}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all duration-150"
              >
                <BookOpen className="w-4 h-4 stroke-[2.2]" />
                <span>Browse Library</span>
              </button>
            )}
          </div>
        ) : filteredNotes.length === 0 ? (
          /* EMPTY STATE 2: Notes exist, but search/filter returned 0 results */
          <div className="py-14 px-6 max-w-sm mx-auto text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Search className="w-6 h-6 stroke-[2]" />
            </div>

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              No Matching Notes
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              {searchQuery.trim()
                ? `No notes match "${searchQuery.trim()}". Try searching for a different keyword or page number.`
                : 'No notes match the selected color or document filters.'}
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-gray-200 dark:bg-zinc-800 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* NOTE CARDS: Modern Apple Notes / Google Keep Aesthetic */
          <div
            className={
              viewMode === 'list'
                ? 'space-y-3 max-w-2xl mx-auto'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'
            }
          >
            {filteredNotes.map((note) => {
              const doc = documents[note.documentId];
              const docTitle = doc?.title || 'Unknown Document';
              const colorKey = (note.color in COLOR_CONFIG ? note.color : 'yellow') as keyof typeof COLOR_CONFIG;
              const config = COLOR_CONFIG[colorKey];

              return (
                <div
                  key={note.id}
                  onClick={() => onOpenDocument(note.documentId, note.pageNumber)}
                  className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.985] flex flex-col justify-between overflow-hidden ${config.cardBg} ${config.cardBorder}`}
                >
                  {/* Colored Left Accent Strip (Google Keep / Apple Notes style) */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.accentBar}`}
                  />

                  <div className="p-4 pl-5 flex flex-col flex-1">
                    {/* Note Card Header: Document Tag & Page Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      {/* Document Title Tag with File Icon */}
                      <div
                        className="flex items-center gap-1.5 min-w-0 max-w-[70%] bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] px-2 py-1 rounded-lg"
                        title={docTitle}
                      >
                        <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0 stroke-[2]" />
                        <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                          {docTitle}
                        </span>
                      </div>

                      {/* Page Badge */}
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 dark:bg-zinc-800/90 text-gray-800 dark:text-zinc-200 border border-black/5 dark:border-white/10 shadow-2xs">
                        Page {note.pageNumber}
                      </span>
                    </div>

                    {/* Note Title */}
                    {note.title && (
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 leading-snug tracking-tight line-clamp-2">
                        {note.title}
                      </h4>
                    )}

                    {/* Note Content */}
                    <p className="text-xs text-gray-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed line-clamp-4 flex-1 font-normal break-words">
                      {note.content}
                    </p>

                    {/* Note Card Footer: Timestamp & Action Controls */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-[11px] text-gray-500 dark:text-gray-400">
                      {/* Formatted Date */}
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 opacity-70 stroke-[2]" />
                        {formatDate(note.updatedAt || note.createdAt)}
                      </span>

                      {/* Right Actions: Delete & Open Page */}
                      <div className="flex items-center gap-1">
                        {/* Delete Note Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteToDelete(note);
                          }}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 flex items-center justify-center transition-colors"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                        </button>

                        {/* Open Page Direct Link */}
                        <div className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500 text-blue-600 dark:text-blue-400 font-bold text-[11px] transition-all">
                          <span>Open</span>
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xl space-y-3.5 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Delete Page Note?
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                Are you sure you want to delete this note from Page {noteToDelete.pageNumber} of{' '}
                <strong className="text-gray-700 dark:text-zinc-300">
                  {documents[noteToDelete.documentId]?.title || 'Document'}
                </strong>
                ? This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setNoteToDelete(null)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={(e) => handleDeleteNote(noteToDelete.id, e)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
