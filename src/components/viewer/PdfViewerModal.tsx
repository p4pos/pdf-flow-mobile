import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PdfDocument, PageNote, ReaderTheme } from '../../types';
import { loadPdf, renderPage, createSamplePdf } from '../../services/pdfService';
import { getDocumentBlob, updateDocumentMeta, getNotesForDocument } from '../../services/db';
import { PageNotesSheet } from './PageNotesSheet';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  StickyNote,
  Sun,
  Moon,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type * as pdfjsLib from 'pdfjs-dist';

export interface PdfViewerModalProps {
  document: PdfDocument | null;
  isOpen: boolean;
  onClose: () => void;
  initialPage?: number;
  initialTheme?: ReaderTheme;
  onToggleFavorite?: (documentId: string, isFavorite: boolean) => void;
  onDocumentUpdate?: (updatedDoc: PdfDocument) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  initialPage = 1,
  initialTheme = 'light',
  onToggleFavorite,
  onDocumentUpdate
}) => {
  // Navigation & document state
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(doc?.pageCount || 1);
  const [scale, setScale] = useState<number>(1.2);
  const [theme, setTheme] = useState<ReaderTheme>(initialTheme);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(doc?.isFavorite || false);
  const [notes, setNotes] = useState<PageNote[]>([]);

  // Loading & error states
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderSequenceRef = useRef<number>(0);
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);

  // Gesture state refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.2);
  const lastTapTimeRef = useRef<number>(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);

  // Sync state when document or modal open changes
  useEffect(() => {
    if (isOpen && doc) {
      setCurrentPage(initialPage > 0 ? initialPage : 1);
      setTotalPages(doc.pageCount || 1);
      setIsFavorite(doc.isFavorite);
      setPdfError(null);
      setScale(1.2);

      // Record last opened timestamp
      updateDocumentMeta(doc.id, { lastOpened: Date.now() }).catch(() => {});

      // Load document notes
      loadDocumentNotes();

      // Load PDF proxy
      initPdfDocument();
    } else {
      // Clean up when closed
      pdfDocRef.current = null;
      renderSequenceRef.current++;
    }
  }, [isOpen, doc?.id]);

  // Load document notes from IndexedDB
  const loadDocumentNotes = async () => {
    if (!doc) return;
    try {
      const docNotes = await getNotesForDocument(doc.id);
      setNotes(docNotes);
    } catch (err) {
      console.error('Failed to load document notes:', err);
    }
  };

  // Initialize and load PDF bytes
  const initPdfDocument = async () => {
    if (!doc) return;
    setIsLoadingPdf(true);
    setPdfError(null);

    try {
      let data = doc.pdfData;
      if (!data) {
        const storedBlob = await getDocumentBlob(doc.id);
        if (storedBlob) {
          data = storedBlob;
        } else {
          // Graceful fallback: generate a sample PDF so the viewer is always testable
          data = createSamplePdf(
            doc.title || 'Mobile PDF Document',
            'Interactive Reader Preview',
            Math.max(doc.pageCount || 3, 1)
          );
        }
      }

      const proxy = await loadPdf(data);
      pdfDocRef.current = proxy;
      setTotalPages(proxy.numPages);
      setIsLoadingPdf(false);

      // Trigger first render
      renderCurrentPage(proxy, currentPage, scale);
    } catch (err: any) {
      console.error('Failed to load PDF document:', err);
      setPdfError(err?.message || 'Could not load PDF document.');
      setIsLoadingPdf(false);
    }
  };

  // Render a specific page onto the canvas
  const renderCurrentPage = useCallback(
    async (proxy: pdfjsLib.PDFDocumentProxy | null, pageNum: number, zoomScale: number) => {
      const currentDoc = proxy || pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!currentDoc || !canvas) return;

      const sequence = ++renderSequenceRef.current;
      setIsRenderingPage(true);

      try {
        const clampedPage = Math.min(Math.max(pageNum, 1), currentDoc.numPages);
        await renderPage(currentDoc, clampedPage, canvas, zoomScale);

        // Check if another render superseded this one
        if (sequence === renderSequenceRef.current) {
          setIsRenderingPage(false);
        }
      } catch (err: any) {
        // Ignore cancelled render errors from rapid page turning
        if (sequence === renderSequenceRef.current) {
          console.warn('Page render error:', err);
          setIsRenderingPage(false);
        }
      }
    },
    []
  );

  // Trigger page render when page or scale changes
  useEffect(() => {
    if (pdfDocRef.current && !isLoadingPdf) {
      renderCurrentPage(pdfDocRef.current, currentPage, scale);
    }
  }, [currentPage, scale, isLoadingPdf, renderCurrentPage]);

  // Page navigation helpers
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const goToPage = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), totalPages);
    setCurrentPage(clamped);
  };

  // Zoom helpers
  const zoomIn = () => {
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 3.5));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(Math.round((prev - 0.25) * 100) / 100, 0.75));
  };

  const resetZoom = () => {
    setScale(1.2);
  };

  // Theme toggle cycle: light -> sepia -> dark -> light
  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'sepia';
      if (prev === 'sepia') return 'dark';
      return 'light';
    });
  };

  // Favorite toggle
  const handleToggleFavorite = async () => {
    if (!doc) return;
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    try {
      await updateDocumentMeta(doc.id, { isFavorite: nextFavorite });
      onToggleFavorite?.(doc.id, nextFavorite);
      if (onDocumentUpdate) {
        onDocumentUpdate({ ...doc, isFavorite: nextFavorite });
      }
    } catch (err) {
      console.error('Failed to update favorite status:', err);
      setIsFavorite(!nextFavorite); // Revert on error
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isNotesOpen) return; // Don't intercept while typing in notes
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevPage();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isNotesOpen, currentPage, totalPages]);

  // Touch handlers: Pinch-to-zoom, Double-tap, and 1-finger horizontal swipe
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch-to-zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // 1 finger: record position for swipe & track double tap
      swipeStartXRef.current = e.touches[0].clientX;
      swipeStartYRef.current = e.touches[0].clientY;

      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        // Double tap! Toggle between 1.0 and 1.8
        setScale((prev) => (prev > 1.2 ? 1.0 : 1.8));
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const targetScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 0.75), 3.5);
      setScale(Math.round(targetScale * 100) / 100);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }

    // 1-finger horizontal swipe navigation (only when zoom is low to avoid interfering with panning)
    if (
      scale <= 1.25 &&
      swipeStartXRef.current !== null &&
      swipeStartYRef.current !== null &&
      e.changedTouches.length === 1
    ) {
      const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - swipeStartYRef.current;

      if (Math.abs(deltaX) > 65 && Math.abs(deltaY) < 55) {
        if (deltaX < 0) {
          goToNextPage();
        } else {
          goToPrevPage();
        }
      }
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
    }
  };

  if (!isOpen || !doc) return null;

  // Compute notes for currently viewed page
  const currentPageNotes = notes.filter((n) => n.pageNumber === currentPage);
  const currentNotesCount = currentPageNotes.length;

  // Canvas visual filter for themes
  let canvasFilter = 'none';
  let viewportBgClass = 'bg-zinc-900';
  let canvasContainerClass = 'bg-white shadow-2xl';

  if (theme === 'dark') {
    canvasFilter = 'invert(0.9) hue-rotate(180deg)';
    viewportBgClass = 'bg-zinc-950';
    canvasContainerClass = 'bg-zinc-900 shadow-2xl border border-zinc-800';
  } else if (theme === 'sepia') {
    canvasFilter = 'sepia(0.4) contrast(0.95) brightness(0.98)';
    viewportBgClass = 'bg-[#f7f0e3] dark:bg-[#25201b]';
    canvasContainerClass = 'bg-[#fdfaf2] shadow-xl border border-[#e8dfcb]';
  } else {
    // Light
    viewportBgClass = 'bg-zinc-200 dark:bg-zinc-900';
    canvasContainerClass = 'bg-white shadow-2xl border border-zinc-300 dark:border-zinc-800';
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Top Header (Frosted Glass, Mobile Friendly) */}
      <header className="relative z-20 w-full glass-nav bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 px-3 py-2.5 pt-safe flex items-center justify-between gap-2 shadow-sm">
        {/* Left: Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-1 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800/80 active:scale-90 transition-all"
          aria-label="Close viewer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Center: Truncated Title & Page Indicator */}
        <div className="flex-1 min-w-0 text-center px-1">
          <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-xs mx-auto">
            {doc.title || doc.fileName}
          </h1>
          <p className="text-[11px] text-zinc-400 font-medium">
            Page {currentPage} of {totalPages}
          </p>
        </div>

        {/* Right Actions: Theme Toggle, Notes Button with Badge, Favorite */}
        <div className="flex items-center space-x-1 shrink-0">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/70 active:scale-95 transition-all"
            title={`Reading theme: ${theme} (tap to cycle)`}
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-amber-400" />}
            {theme === 'sepia' && <BookOpen className="w-4 h-4 text-amber-600" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-sky-400" />}
          </button>

          {/* In-Page Note Button with Badge */}
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/70 active:scale-95 transition-all"
            title={`Page notes (${currentNotesCount} notes on page ${currentPage})`}
          >
            <StickyNote className="w-4 h-4" />
            {currentNotesCount > 0 && (
              <span className="absolute 0 top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center shadow-md animate-in zoom-in-50">
                {currentNotesCount}
              </span>
            )}
          </button>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/70 active:scale-95 transition-all"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFavorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-400'
              }`}
            />
          </button>
        </div>
      </header>

      {/* Main Canvas Viewport with Touch Gestures */}
      <div
        ref={viewportContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 relative overflow-auto flex items-center justify-center p-3 transition-colors duration-300 ${viewportBgClass}`}
      >
        {/* Loading Spinner */}
        {isLoadingPdf && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-zinc-300">Opening document...</p>
          </div>
        )}

        {/* Error State */}
        {pdfError && (
          <div className="max-w-sm mx-auto p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Failed to render PDF</h3>
            <p className="text-xs text-zinc-400">{pdfError}</p>
            <button
              type="button"
              onClick={initPdfDocument}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Page Canvas Rendering Wrapper */}
        <div
          className={`relative max-w-none transition-transform duration-100 ease-out rounded-lg overflow-hidden ${canvasContainerClass}`}
          style={{
            filter: canvasFilter,
            transformOrigin: 'center center'
          }}
        >
          {/* Canvas Element */}
          <canvas ref={canvasRef} className="block max-w-none" />

          {/* Rendering overlay indicator */}
          {isRenderingPage && (
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center">
              <div className="p-2 rounded-full bg-zinc-900/70 text-zinc-300 shadow">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Floating Zoom Controls (+ / - / Reset) */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center bg-zinc-900/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 rounded-full shadow-lg p-1 text-zinc-300">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 rounded-full hover:bg-zinc-800 active:scale-90 transition-all"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:text-white"
            title="Reset zoom to 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 rounded-full hover:bg-zinc-800 active:scale-90 transition-all"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar (Frosted Glass, Large Touch Controls) */}
      <footer className="relative z-20 w-full glass-tabbar bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/80 px-4 py-2 pb-safe flex flex-col space-y-2 shadow-lg">
        {/* Quick Note Indicator Pill */}
        {currentNotesCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="mx-auto inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:text-amber-200 hover:bg-amber-500/25 active:scale-95 transition-all text-xs font-medium"
          >
            <span>📝</span>
            <span>
              {currentNotesCount} {currentNotesCount === 1 ? 'note' : 'notes'} on this page - tap to view
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="mx-auto inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-zinc-400 hover:text-zinc-200 text-[11px] hover:bg-zinc-800/50 active:scale-95 transition-all"
          >
            <StickyNote className="w-3 h-3" />
            <span>+ Add note to page {currentPage}</span>
          </button>
        )}

        {/* Navigation & Slider */}
        <div className="flex items-center space-x-3">
          {/* Previous Page Button */}
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-100 active:scale-90 transition-transform shadow"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Scrub Slider */}
          <div className="flex-1 flex flex-col items-center px-1">
            <input
              type="range"
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
              aria-label="Scrub page slider"
            />
            <div className="w-full flex justify-between text-[10px] text-zinc-400 font-medium mt-1">
              <span>Page 1</span>
              <span className="text-zinc-200 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <span>Page {totalPages}</span>
            </div>
          </div>

          {/* Next Page Button */}
          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-100 active:scale-90 transition-transform shadow"
            aria-label="Next page"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Page Notes Sheet Modal */}
      <PageNotesSheet
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        documentId={doc.id}
        pageNumber={currentPage}
        initialNotes={notes}
        onNotesChange={loadDocumentNotes}
      />
    </div>
  );
};
