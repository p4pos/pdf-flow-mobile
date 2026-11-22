import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PdfDocument, PageNote, ReaderTheme } from '../../types';
import { loadPdf, renderPage, createSamplePdf, getPageDimensions } from '../../services/pdfService';
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
  RefreshCw,
  StretchHorizontal,
  Minimize2
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
  onPageChange?: (page: number) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  initialPage = 1,
  initialTheme = 'light',
  onToggleFavorite,
  onDocumentUpdate,
  onPageChange
}) => {
  // Navigation & document state
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(doc?.pageCount || 1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
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
  const pageDimensionsRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const lastRenderedKeyRef = useRef<string>('');

  // Gesture state refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);
  const lastTapTimeRef = useRef<number>(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const lastTouchXRef = useRef<number | null>(null);
  const lastTouchYRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const cachedFitWidthScaleRef = useRef<number>(1.0);
  const isMouseDownRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number | null>(null);
  const lastMouseYRef = useRef<number | null>(null);

  // Helper to calculate target scale based on unscaled page dimensions and mode
  const calculateScaleForMode = useCallback(
    (unscaledWidth: number, unscaledHeight: number, mode: 'width' | 'page'): number => {
      const containerWidth = viewportContainerRef.current?.clientWidth || window.innerWidth;
      const containerHeight =
        viewportContainerRef.current?.clientHeight || (window.innerHeight - 130);

      // Mobile padding: 24px total for compact screens, 32px for larger displays
      const horizontalPadding = containerWidth <= 480 ? 24 : 32;
      const availableWidth = Math.max(containerWidth - horizontalPadding, 100);

      if (mode === 'width') {
        const targetScale = availableWidth / unscaledWidth;
        return Math.min(Math.max(Math.round(targetScale * 100) / 100, 0.4), 3.0);
      } else {
        const verticalPadding = 24;
        const availableHeight = Math.max(containerHeight - verticalPadding, 100);
        const scaleX = availableWidth / unscaledWidth;
        const scaleY = availableHeight / unscaledHeight;
        const targetScale = Math.min(scaleX, scaleY);
        return Math.min(Math.max(Math.round(targetScale * 100) / 100, 0.35), 3.0);
      }
    },
    []
  );

  // Cached retrieval of unscaled page dimensions
  const getPageDimensionsCached = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<{ width: number; height: number }> => {
      const cached = pageDimensionsRef.current.get(pageNum);
      if (cached) return cached;
      const dims = await getPageDimensions(pdf, pageNum);
      pageDimensionsRef.current.set(pageNum, dims);
      return dims;
    },
    []
  );

  // Helper to obtain current page's fit-width scale synchronously from cache or fallback
  const getFitWidthScale = useCallback((): number => {
    const cachedDims = pageDimensionsRef.current.get(currentPage);
    if (cachedDims) {
      const computed = calculateScaleForMode(cachedDims.width, cachedDims.height, 'width');
      cachedFitWidthScaleRef.current = computed;
      return computed;
    }
    return cachedFitWidthScaleRef.current || 1.0;
  }, [currentPage, calculateScaleForMode]);

  // Sync state when document or modal open changes
  useEffect(() => {
    if (isOpen && doc) {
      setCurrentPage(initialPage > 0 ? initialPage : 1);
      setTotalPages(doc.pageCount || 1);
      setIsFavorite(doc.isFavorite);
      setPdfError(null);
      setFitMode('width');
      lastRenderedKeyRef.current = '';
      pageDimensionsRef.current.clear();

      // Record last opened timestamp
      updateDocumentMeta(doc.id, { lastOpened: Date.now() }).catch(() => {});

      // Load document notes
      loadDocumentNotes();

      // Load PDF proxy and auto fit-to-width
      initPdfDocument();
    } else {
      // Clean up when closed
      pdfDocRef.current = null;
      renderSequenceRef.current++;
      lastRenderedKeyRef.current = '';
      pageDimensionsRef.current.clear();
    }
  }, [isOpen, doc?.id]);

  // Report current page change for reader session persistence
  useEffect(() => {
    if (isOpen && currentPage > 0) {
      onPageChange?.(currentPage);
    }
  }, [isOpen, currentPage, onPageChange]);

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

      // Auto fit-to-width on initial load
      const startPage = initialPage > 0 ? Math.min(initialPage, proxy.numPages) : 1;
      const dims = await getPageDimensionsCached(proxy, startPage);
      const initialScale = calculateScaleForMode(dims.width, dims.height, 'width');
      cachedFitWidthScaleRef.current = initialScale;

      setFitMode('width');
      setScale(initialScale);
      renderCurrentPage(proxy, startPage, initialScale);
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

      const clampedPage = Math.min(Math.max(pageNum, 1), currentDoc.numPages);
      const renderKey = `${clampedPage}@${zoomScale.toFixed(2)}`;
      if (lastRenderedKeyRef.current === renderKey) {
        return;
      }

      const sequence = ++renderSequenceRef.current;
      setIsRenderingPage(true);

      try {
        await renderPage(currentDoc, clampedPage, canvas, zoomScale);

        // Check if another render superseded this one
        if (sequence === renderSequenceRef.current) {
          lastRenderedKeyRef.current = renderKey;
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

  // Trigger page render or scale update when page changes
  useEffect(() => {
    if (!pdfDocRef.current || isLoadingPdf) return;

    let isCancelled = false;

    if (fitMode === 'custom') {
      renderCurrentPage(pdfDocRef.current, currentPage, scale);
      return;
    }

    // Auto fit for this page
    getPageDimensionsCached(pdfDocRef.current, currentPage).then((dims) => {
      if (isCancelled) return;
      const targetScale = calculateScaleForMode(dims.width, dims.height, fitMode);
      if (Math.abs(targetScale - scale) > 0.02) {
        setScale(targetScale);
      } else {
        renderCurrentPage(pdfDocRef.current, currentPage, scale);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentPage, fitMode, isLoadingPdf, calculateScaleForMode, getPageDimensionsCached, renderCurrentPage]);

  // Trigger page render when scale changes
  useEffect(() => {
    if (pdfDocRef.current && !isLoadingPdf) {
      renderCurrentPage(pdfDocRef.current, currentPage, scale);
    }
  }, [scale, currentPage, isLoadingPdf, renderCurrentPage]);

  // Reset scroll position to top-left when page changes
  useEffect(() => {
    if (viewportContainerRef.current) {
      viewportContainerRef.current.scrollTop = 0;
      viewportContainerRef.current.scrollLeft = 0;
    }
  }, [currentPage]);

  // Re-calculate fit scale when window or device orientation changes
  useEffect(() => {
    if (!isOpen) return;

    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        if (fitMode !== 'custom' && pdfDocRef.current) {
          const dims = await getPageDimensionsCached(pdfDocRef.current, currentPage);
          const newScale = calculateScaleForMode(dims.width, dims.height, fitMode);
          if (Math.abs(newScale - scale) > 0.02) {
            setScale(newScale);
          }
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, fitMode, currentPage, scale, calculateScaleForMode, getPageDimensionsCached]);

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

  // Toggle between Fit Width and Fit Page
  const toggleFitMode = async () => {
    const nextMode = fitMode === 'width' ? 'page' : 'width';
    setFitMode(nextMode);
    if (pdfDocRef.current) {
      const dims = await getPageDimensionsCached(pdfDocRef.current, currentPage);
      const nextScale = calculateScaleForMode(dims.width, dims.height, nextMode);
      setScale(nextScale);
    }
  };

  // Zoom helpers
  const zoomIn = () => {
    setFitMode('custom');
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 3.5));
  };

  const zoomOut = () => {
    setFitMode('custom');
    setScale((prev) => Math.max(Math.round((prev - 0.25) * 100) / 100, 0.4));
  };

  const resetZoom = async () => {
    setFitMode('width');
    const fitScale = getFitWidthScale();
    setScale(fitScale);
    viewportContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
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

  // Double-tap helper to toggle between fit-width and 2x zoom
  const handleDoubleTap = async () => {
    const fitWidthScale = getFitWidthScale();
    if (scale > fitWidthScale * 1.05) {
      setFitMode('width');
      setScale(fitWidthScale);
      viewportContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } else {
      setFitMode('custom');
      setScale(Math.min(Math.round(fitWidthScale * 2.0 * 100) / 100, 3.5));
    }
  };

  // Touch handlers: Pinch-to-zoom, Double-tap, 1-finger horizontal swipe page flip, and smooth drag-to-pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch-to-zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      isDraggingRef.current = false;
      lastTouchXRef.current = null;
      lastTouchYRef.current = null;
    } else if (e.touches.length === 1) {
      // 1 finger: record position for swipe, tap & drag-to-pan
      const touch = e.touches[0];
      swipeStartXRef.current = touch.clientX;
      swipeStartYRef.current = touch.clientY;
      lastTouchXRef.current = touch.clientX;
      lastTouchYRef.current = touch.clientY;
      isDraggingRef.current = true;

      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap();
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      // Pinch-to-zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const targetScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, 0.4), 3.5);
      setFitMode('custom');
      setScale(Math.round(targetScale * 100) / 100);
    } else if (
      e.touches.length === 1 &&
      isDraggingRef.current &&
      lastTouchXRef.current !== null &&
      lastTouchYRef.current !== null
    ) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - lastTouchXRef.current;
      const deltaY = currentY - lastTouchYRef.current;

      const fitWidthScale = getFitWidthScale();
      // Smooth 1-finger drag-to-pan in all 360 degrees when zoomed in
      if (scale > fitWidthScale * 1.05 && viewportContainerRef.current) {
        viewportContainerRef.current.scrollLeft -= deltaX;
        viewportContainerRef.current.scrollTop -= deltaY;
      }

      lastTouchXRef.current = currentX;
      lastTouchYRef.current = currentY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
      lastTouchXRef.current = null;
      lastTouchYRef.current = null;
    }

    const fitWidthScale = getFitWidthScale();
    const isZoomed = scale > fitWidthScale * 1.05;

    // 1-finger horizontal swipe navigation:
    // ONLY allowed when scale <= fitWidthScale * 1.05 to prevent accidental page flips when zoomed in!
    if (
      !isZoomed &&
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
    }

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  const handleTouchCancel = () => {
    pinchStartDistRef.current = null;
    isDraggingRef.current = false;
    lastTouchXRef.current = null;
    lastTouchYRef.current = null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  // Mouse drag panning support (for desktop / trackpad users when zoomed in)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const fitWidthScale = getFitWidthScale();
    if (scale > fitWidthScale * 1.05 && e.button === 0) {
      isMouseDownRef.current = true;
      lastMouseXRef.current = e.clientX;
      lastMouseYRef.current = e.clientY;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMouseDownRef.current && lastMouseXRef.current !== null && lastMouseYRef.current !== null) {
      const deltaX = e.clientX - lastMouseXRef.current;
      const deltaY = e.clientY - lastMouseYRef.current;
      if (viewportContainerRef.current) {
        viewportContainerRef.current.scrollLeft -= deltaX;
        viewportContainerRef.current.scrollTop -= deltaY;
      }
      lastMouseXRef.current = e.clientX;
      lastMouseYRef.current = e.clientY;
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    lastMouseXRef.current = null;
    lastMouseYRef.current = null;
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
      {/* Top Header (Solid/frosted dark reader bar, high-contrast in all themes) */}
      <header className="relative z-20 w-full bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 text-zinc-100 px-3 py-2.5 pt-safe flex items-center justify-between gap-2 shadow-lg">
        {/* Left: Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-1 rounded-full text-zinc-200 hover:text-white hover:bg-zinc-800/90 active:scale-90 transition-all"
          aria-label="Close viewer"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        {/* Center: Truncated Title & Page Indicator */}
        <div className="flex-1 min-w-0 text-center px-1">
          <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-xs mx-auto">
            {doc.title || doc.fileName}
          </h1>
          <p className="text-[11px] text-zinc-300 font-medium">
            Page {currentPage} of {totalPages}
          </p>
        </div>

        {/* Right Actions: Fit Toggle, Theme Toggle, Notes Button with Badge, Favorite */}
        <div className="flex items-center space-x-1 shrink-0">
          {/* Quick Fit Width / Page Toggle */}
          <button
            type="button"
            onClick={toggleFitMode}
            className="p-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
            title={
              fitMode === 'width'
                ? 'Fit Width active. Tap for Fit Page'
                : fitMode === 'page'
                ? 'Fit Page active. Tap for Fit Width'
                : 'Tap to Fit Width'
            }
            aria-label="Toggle Fit Mode"
          >
            {fitMode === 'page' ? (
              <StretchHorizontal className="w-4 h-4 text-blue-400" />
            ) : (
              <Minimize2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
            title={`Reading theme: ${theme} (tap to cycle)`}
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-amber-400" />}
            {theme === 'sepia' && <BookOpen className="w-4 h-4 text-amber-500" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-sky-400" />}
          </button>

          {/* In-Page Note Button with Badge */}
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="relative p-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
            title={`Page notes (${currentNotesCount} notes on page ${currentPage})`}
          >
            <StickyNote className="w-4 h-4 text-zinc-200" />
            {currentNotesCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black flex items-center justify-center shadow-md animate-in zoom-in-50">
                {currentNotesCount}
              </span>
            )}
          </button>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            className="p-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFavorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-300 hover:text-white'
              }`}
            />
          </button>
        </div>
      </header>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable Viewport with Touch Gestures */}
        <div
          ref={viewportContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ WebkitOverflowScrolling: 'touch' }}
          className={`absolute inset-0 overflow-auto overscroll-contain touch-pan-x touch-pan-y transition-colors duration-300 ${viewportBgClass} ${
            scale > getFitWidthScale() * 1.05 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {/* Loading Spinner */}
          {isLoadingPdf && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-zinc-200">Opening document...</p>
            </div>
          )}

          {/* Error State */}
          {pdfError ? (
            <div className="min-w-full min-h-full flex items-center justify-center p-4">
              <div className="max-w-sm p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
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
            </div>
          ) : (
            /* Sizing container: min-w-full min-h-full w-max h-max flex items-center justify-center p-6
               Ensures full 360-degree scrollability from true top-left corner without clipping data loss */
            <div className="min-w-full min-h-full w-max h-max flex items-center justify-center p-6">
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
            </div>
          )}
        </div>

        {/* Floating Zoom & Fit Controls (Always pinned at bottom-right, razor-sharp dark contrast) */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center bg-zinc-950/95 backdrop-blur-md border border-zinc-700/80 rounded-full shadow-2xl p-1 text-zinc-200 space-x-1">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white active:scale-90 transition-all"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-0.5 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-800/80 rounded-md transition-colors"
            title="Reset zoom to Fit Width"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white active:scale-90 transition-all"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-zinc-700 mx-0.5" />

          {/* One-tap "Fit Width" / "Fit Page" toggle button */}
          <button
            type="button"
            onClick={toggleFitMode}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 transition-all border border-zinc-700/60 shadow-sm"
            title={
              fitMode === 'width'
                ? 'Currently Fit Width. Tap to Fit Page'
                : fitMode === 'page'
                ? 'Currently Fit Page. Tap to Fit Width'
                : 'Tap to Fit Width'
            }
            aria-label="Toggle Fit Mode"
          >
            {fitMode === 'page' ? (
              <>
                <StretchHorizontal className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-semibold text-zinc-100">Fit Page</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-zinc-100">Fit Width</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar (Solid/frosted dark reader styling, high-contrast) */}
      <footer className="relative z-20 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 text-zinc-100 px-4 py-2 pb-safe flex flex-col space-y-2 shadow-lg">
        {/* Quick Note Indicator Pill */}
        {currentNotesCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="mx-auto inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:text-white hover:bg-amber-500/30 active:scale-95 transition-all text-xs font-semibold shadow-sm"
          >
            <span className="text-amber-400">📝</span>
            <span>
              {currentNotesCount} {currentNotesCount === 1 ? 'note' : 'notes'} on this page - tap to view
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="mx-auto inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-zinc-300 hover:text-white text-xs font-medium bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 active:scale-95 transition-all shadow-sm"
          >
            <StickyNote className="w-3.5 h-3.5 text-zinc-400" />
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
            className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-25 disabled:pointer-events-none text-white active:scale-90 transition-transform shadow-md border border-zinc-700/60"
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
            <div className="w-full flex justify-between text-[11px] text-zinc-300 font-medium mt-1">
              <span>Page 1</span>
              <span className="text-white font-bold">
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
            className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-25 disabled:pointer-events-none text-white active:scale-90 transition-transform shadow-md border border-zinc-700/60"
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
