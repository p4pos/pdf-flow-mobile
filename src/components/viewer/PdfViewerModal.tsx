import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PdfDocument, PageNote, ReaderTheme } from '../../types';
import { loadPdf, createSamplePdf, getPageDimensions } from '../../services/pdfService';
import { getDocumentBlob, updateDocumentMeta, getNotesForDocument } from '../../services/db';
import { PageNotesSheet } from './PageNotesSheet';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  StickyNote,
  Sun,
  Moon,
  BookOpen,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  RefreshCw,
  StretchHorizontal,
  Minimize2,
  Scroll,
  FileText
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

export type ViewerMode = 'continuous' | 'single';

/**
 * ContinuousPageCanvas:
 * Renders an individual page canvas with High-DPI crisp resolution.
 * Handles rendering cancellation gracefully if user rapidly scrolls past.
 */
interface ContinuousPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
}

const ContinuousPageCanvas: React.FC<ContinuousPageCanvasProps> = React.memo(
  ({ pdfDoc, pageNumber, scale, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isRendered, setIsRendered] = useState<boolean>(false);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

    useEffect(() => {
      if (!pdfDoc || !canvasRef.current) return;
      let isCancelled = false;

      const render = async () => {
        // Cancel any previous in-flight render on this canvas
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel errors
          }
          renderTaskRef.current = null;
        }

        try {
          const page = await pdfDoc.getPage(pageNumber);
          if (isCancelled || !canvasRef.current) return;

          const viewport = page.getViewport({ scale });
          const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;

          const canvas = canvasRef.current;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) return;

          // Crisp opaque white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const renderContext = {
            canvasContext: ctx,
            viewport,
            transform: [dpr, 0, 0, dpr, 0, 0] as [number, number, number, number, number, number],
          };

          const task = page.render(renderContext);
          renderTaskRef.current = task;
          await task.promise;

          if (!isCancelled) {
            setIsRendered(true);
          }
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn(`Render error on page ${pageNumber}:`, err);
          }
        } finally {
          renderTaskRef.current = null;
        }
      };

      render();

      return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel
          }
          renderTaskRef.current = null;
        }
      };
    }, [pdfDoc, pageNumber, scale]);

    return (
      <div className="relative w-full h-full">
        <canvas ref={canvasRef} className="block w-full h-full max-w-none" />
        {!isRendered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/70 dark:bg-zinc-800/50 backdrop-blur-[1px]">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-1.5" />
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Loading page...</span>
          </div>
        )}
      </div>
    );
  }
);

ContinuousPageCanvas.displayName = 'ContinuousPageCanvas';

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
  // Navigation & viewer mode (Continuous Scroll is default mode)
  const [mode, setMode] = useState<ViewerMode>('continuous');
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(doc?.pageCount || 1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [theme, setTheme] = useState<ReaderTheme>(initialTheme);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [activeNotePage, setActiveNotePage] = useState<number>(initialPage);
  const [isFavorite, setIsFavorite] = useState<boolean>(doc?.isFavorite || false);
  const [notes, setNotes] = useState<PageNote[]>([]);

  // Loading & error states
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Lazy rendering & scrubber visibility state
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([initialPage]));
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Smooth GPU pinch-to-zoom state (prevents re-rendering canvas on every touch tick!)
  const [gestureScale, setGestureScale] = useState<number>(1.0);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const [pinchCenter, setPinchCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // References
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageDimensionsRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const defaultDimsRef = useRef<{ width: number; height: number }>({ width: 595, height: 842 });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrubberTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<any>(null);
  const rafIdRef = useRef<number>(0);
  const hasInitialScrolledRef = useRef<boolean>(false);

  // Gesture state refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);
  const lastTapTimeRef = useRef<number>(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const cachedFitWidthScaleRef = useRef<number>(1.0);
  const isMouseDownRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number | null>(null);
  const lastMouseYRef = useRef<number | null>(null);

  // Calculate target scale for fit modes
  const calculateScaleForMode = useCallback(
    (unscaledWidth: number, unscaledHeight: number, targetFitMode: 'width' | 'page'): number => {
      const containerWidth = viewportContainerRef.current?.clientWidth || window.innerWidth;
      const containerHeight =
        viewportContainerRef.current?.clientHeight || (window.innerHeight - 130);

      // Mobile padding: 16px total for narrow screens, 28px for larger screens
      const horizontalPadding = containerWidth <= 480 ? 16 : 28;
      const availableWidth = Math.max(containerWidth - horizontalPadding, 100);

      if (targetFitMode === 'width') {
        const targetScale = availableWidth / unscaledWidth;
        return Math.min(Math.max(Math.round(targetScale * 100) / 100, 0.4), 3.5);
      } else {
        const verticalPadding = 24;
        const availableHeight = Math.max(containerHeight - verticalPadding, 100);
        const scaleX = availableWidth / unscaledWidth;
        const scaleY = availableHeight / unscaledHeight;
        const targetScale = Math.min(scaleX, scaleY);
        return Math.min(Math.max(Math.round(targetScale * 100) / 100, 0.35), 3.5);
      }
    },
    []
  );

  // Synchronously compute fit-width scale from cached page dimensions
  const getFitWidthScale = useCallback((): number => {
    const cachedDims =
      pageDimensionsRef.current.get(currentPage) || defaultDimsRef.current;
    if (cachedDims) {
      const computed = calculateScaleForMode(cachedDims.width, cachedDims.height, 'width');
      cachedFitWidthScaleRef.current = computed;
      return computed;
    }
    return cachedFitWidthScaleRef.current || 1.0;
  }, [currentPage, calculateScaleForMode]);

  // Load document notes from IndexedDB
  const loadDocumentNotes = useCallback(async () => {
    if (!doc) return;
    try {
      const docNotes = await getNotesForDocument(doc.id);
      setNotes(docNotes);
    } catch (err) {
      console.error('Failed to load document notes:', err);
    }
  }, [doc]);

  // Initialize and load PDF bytes
  const initPdfDocument = useCallback(async () => {
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
          // Graceful fallback: generate a sample PDF
          data = createSamplePdf(
            doc.title || 'Mobile PDF Document',
            'Continuous High-Speed Reader',
            Math.max(doc.pageCount || 5, 1)
          );
        }
      }

      const proxy = await loadPdf(data);
      pdfDocRef.current = proxy;
      setTotalPages(proxy.numPages);

      // Cache page 1 dimensions as base
      const page1Dims = await getPageDimensions(proxy, 1);
      defaultDimsRef.current = page1Dims;
      pageDimensionsRef.current.set(1, page1Dims);

      // Pre-compute initial fit-width scale
      const initialScale = calculateScaleForMode(page1Dims.width, page1Dims.height, 'width');
      cachedFitWidthScaleRef.current = initialScale;
      setScale(initialScale);
      setFitMode('width');

      setIsLoadingPdf(false);
    } catch (err: any) {
      console.error('Failed to load PDF document:', err);
      setPdfError(err?.message || 'Could not load PDF document.');
      setIsLoadingPdf(false);
    }
  }, [doc, calculateScaleForMode]);

  // Sync state when document or modal open changes
  useEffect(() => {
    if (isOpen && doc) {
      setCurrentPage(initialPage > 0 ? initialPage : 1);
      setActiveNotePage(initialPage > 0 ? initialPage : 1);
      setTotalPages(doc.pageCount || 1);
      setIsFavorite(doc.isFavorite);
      setPdfError(null);
      setFitMode('width');
      setVisiblePages(new Set([initialPage > 0 ? initialPage : 1]));
      hasInitialScrolledRef.current = false;
      pageDimensionsRef.current.clear();

      // Record last opened timestamp
      updateDocumentMeta(doc.id, { lastOpened: Date.now() }).catch(() => {});

      // Load document notes
      loadDocumentNotes();

      // Load PDF
      initPdfDocument();
    } else {
      // Clean up when closed
      pdfDocRef.current = null;
      pageDimensionsRef.current.clear();
      pageElementsRef.current.clear();
      hasInitialScrolledRef.current = false;
    }
  }, [isOpen, doc?.id, initialPage, initPdfDocument, loadDocumentNotes]);

  // Report current page change for reader session persistence
  useEffect(() => {
    if (isOpen && currentPage > 0) {
      onPageChange?.(currentPage);
    }
  }, [isOpen, currentPage, onPageChange]);

  // Prevent browser-level pinch-zoom on mobile viewport to ensure buttery smooth custom canvas zoom
  useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;

    const onNativeTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault(); // Lock browser zoom, allow our custom GPU pinch-zoom
      }
    };

    el.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onNativeTouchMove);
    };
  }, [isOpen]);

  // Scroll to a specific page element
  const scrollToPage = useCallback(
    (targetPage: number, behavior: ScrollBehavior = 'smooth') => {
      const clamped = Math.min(Math.max(targetPage, 1), totalPages);
      setCurrentPage(clamped);

      if (mode === 'single') {
        return;
      }

      const el = pageElementsRef.current.get(clamped);
      const container = viewportContainerRef.current;
      if (el && container) {
        const elTop = el.offsetTop;
        container.scrollTo({
          top: Math.max(0, elTop - 12),
          behavior
        });
      }
    },
    [totalPages, mode]
  );

  // Auto-scroll to initialPage once pages are mounted in continuous mode
  useEffect(() => {
    if (!isLoadingPdf && !hasInitialScrolledRef.current && totalPages > 0) {
      hasInitialScrolledRef.current = true;
      if (initialPage > 1 && initialPage <= totalPages) {
        const timer = setTimeout(() => {
          scrollToPage(initialPage, 'auto');
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoadingPdf, initialPage, totalPages, scrollToPage]);

  // Virtualized IntersectionObserver: Pre-renders pages near viewport, unloads distant pages to preserve mobile RAM
  useEffect(() => {
    if (!isOpen || isLoadingPdf || mode !== 'continuous') return;

    const root = viewportContainerRef.current;
    if (!root) return;

    // Generous rootMargin so pages 1-2 screens away are pre-rendered before scrolling into view
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          let hasChanges = false;
          const next = new Set(prev);
          entries.forEach((entry) => {
            const pageNum = Number(entry.target.getAttribute('data-page-number'));
            if (pageNum) {
              if (entry.isIntersecting) {
                if (!next.has(pageNum)) {
                  next.add(pageNum);
                  hasChanges = true;
                }
              } else {
                if (next.has(pageNum)) {
                  next.delete(pageNum);
                  hasChanges = true;
                }
              }
            }
          });
          return hasChanges ? next : prev;
        });
      },
      {
        root,
        rootMargin: '700px 0px 700px 0px',
        threshold: 0.01
      }
    );

    observerRef.current = observer;

    // Observe all currently registered page elements
    pageElementsRef.current.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [isOpen, isLoadingPdf, mode, totalPages]);

  // Throttled scroll handler: updates current page indicator and manages fast-scroll scrubber visibility
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1400);

    if (mode !== 'continuous') return;

    const container = viewportContainerRef.current;
    if (!container) return;

    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      let closestPage = currentPage;
      let minDistance = Infinity;

      pageElementsRef.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const dist = Math.abs(pageCenter - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = pageNum;
        }
      });

      if (closestPage !== currentPage) {
        setCurrentPage(closestPage);
      }
    });
  }, [mode, currentPage]);

  // Page navigation helpers
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      if (mode === 'continuous') {
        scrollToPage(currentPage + 1, 'smooth');
      } else {
        setCurrentPage((prev) => prev + 1);
      }
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      if (mode === 'continuous') {
        scrollToPage(currentPage - 1, 'smooth');
      } else {
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  // Toggle Continuous vs Single Page reader mode
  const toggleReaderMode = () => {
    const nextMode: ViewerMode = mode === 'continuous' ? 'single' : 'continuous';
    setMode(nextMode);
    if (nextMode === 'continuous') {
      setTimeout(() => {
        scrollToPage(currentPage, 'auto');
      }, 50);
    }
  };

  // Toggle Fit Mode
  const toggleFitMode = () => {
    const nextMode = fitMode === 'width' ? 'page' : 'width';
    setFitMode(nextMode);
    const cachedDims =
      pageDimensionsRef.current.get(currentPage) || defaultDimsRef.current;
    const nextScale = calculateScaleForMode(cachedDims.width, cachedDims.height, nextMode);
    setScale(nextScale);
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

  const resetZoom = () => {
    setFitMode('width');
    const fitScale = getFitWidthScale();
    setScale(fitScale);
    if (mode === 'single' && viewportContainerRef.current) {
      viewportContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  // Double-tap helper to toggle between fit-width and 2x zoom
  const handleDoubleTap = () => {
    const fitWidthScale = getFitWidthScale();
    if (scale > fitWidthScale * 1.05) {
      setFitMode('width');
      setScale(fitWidthScale);
    } else {
      setFitMode('custom');
      setScale(Math.min(Math.round(fitWidthScale * 2.0 * 100) / 100, 3.5));
    }
  };

  // Touch handlers: Smooth GPU Pinch-to-zoom, Double-tap, 1-finger fling and 360° pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch-to-zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;

      const containerRect = viewportContainerRef.current?.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - (containerRect?.left || 0);
      const midY = (t1.clientY + t2.clientY) / 2 - (containerRect?.top || 0);
      setPinchCenter({ x: midX, y: midY });
      setIsPinching(true);
      isMouseDownRef.current = false;
    } else if (e.touches.length === 1) {
      // 1 finger: record position for swipe & double tap
      const touch = e.touches[0];
      swipeStartXRef.current = touch.clientX;
      swipeStartYRef.current = touch.clientY;

      const now = Date.now();
      if (now - lastTapTimeRef.current < 280) {
        handleDoubleTap();
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      // Hardware-accelerated GPU scale multiplier during pinch (60-120fps smooth)
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / pinchStartDistRef.current;
      setGestureScale(ratio);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPinching && e.touches.length < 2) {
      // Commit final scale on gesture end & trigger debounced crisp re-render
      if (pinchStartDistRef.current && gestureScale !== 1.0) {
        const finalScale = Math.min(
          Math.max(pinchStartScaleRef.current * gestureScale, 0.4),
          3.5
        );
        setFitMode('custom');
        setScale(Math.round(finalScale * 100) / 100);
      }
      setGestureScale(1.0);
      setIsPinching(false);
      pinchStartDistRef.current = null;
    }

    // 1-finger horizontal swipe in Single Page mode
    if (
      mode === 'single' &&
      scale <= getFitWidthScale() * 1.05 &&
      swipeStartXRef.current !== null &&
      swipeStartYRef.current !== null &&
      e.changedTouches.length === 1
    ) {
      const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - swipeStartYRef.current;

      if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 50) {
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
    setGestureScale(1.0);
    setIsPinching(false);
    pinchStartDistRef.current = null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  // Mouse drag panning support (for desktop / trackpads when zoomed in)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 && scale > getFitWidthScale() * 1.05) {
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

  // Fast-Scroll Scrubber touch/mouse calculations
  const handleScrubberMove = useCallback(
    (clientY: number) => {
      const track = scrubberTrackRef.current;
      if (!track || totalPages <= 1) return;

      const rect = track.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const ratio = rect.height > 0 ? relativeY / rect.height : 0;
      const targetPage = Math.max(1, Math.min(totalPages, Math.round(1 + ratio * (totalPages - 1))));

      if (targetPage !== currentPage) {
        scrollToPage(targetPage, 'auto');
      }
    },
    [totalPages, currentPage, scrollToPage]
  );

  const handleScrubberTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(true);
    setIsScrolling(true);
    if (e.touches.length > 0) {
      handleScrubberMove(e.touches[0].clientY);
    }
  };

  const handleScrubberTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      handleScrubberMove(e.touches[0].clientY);
    }
  };

  const handleScrubberTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1200);
  };

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(true);
    setIsScrolling(true);
    handleScrubberMove(e.clientY);

    const onWindowMouseMove = (moveEvent: MouseEvent) => {
      handleScrubberMove(moveEvent.clientY);
    };

    const onWindowMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1200);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  // Open notes sheet for a specific page
  const openNotesForPage = (pageNum: number) => {
    setActiveNotePage(pageNum);
    setIsNotesOpen(true);
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
      setIsFavorite(!nextFavorite);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isNotesOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') {
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
  }, [isOpen, isNotesOpen, currentPage, totalPages, mode]);

  // Window resize handler
  useEffect(() => {
    if (!isOpen) return;

    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (fitMode !== 'custom') {
          const dims =
            pageDimensionsRef.current.get(currentPage) || defaultDimsRef.current;
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
  }, [isOpen, fitMode, currentPage, scale, calculateScaleForMode]);

  if (!isOpen || !doc) return null;

  // Notes for current visible page
  const currentPageNotes = notes.filter((n) => n.pageNumber === currentPage);
  const currentNotesCount = currentPageNotes.length;

  // Visual filter for reader themes
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

  const isZoomed = scale > getFitWidthScale() * 1.05;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Top Header Toolbar */}
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
          <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[170px] sm:max-w-xs mx-auto">
            {doc.title || doc.fileName}
          </h1>
          <p className="text-[11px] text-zinc-300 font-medium">
            Page {currentPage} of {totalPages}
          </p>
        </div>

        {/* Right Actions: Mode Toggle, Fit Toggle, Theme Toggle, Notes Button with Badge, Favorite */}
        <div className="flex items-center space-x-1 shrink-0">
          {/* Continuous Scroll vs Single Page Mode Toggle */}
          <button
            type="button"
            onClick={toggleReaderMode}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              mode === 'continuous'
                ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                : 'text-zinc-200 hover:text-white hover:bg-zinc-800/80'
            }`}
            title={
              mode === 'continuous'
                ? 'Continuous Scroll active (tap for Single Page)'
                : 'Single Page active (tap for Continuous Scroll)'
            }
            aria-label="Toggle Reader Mode"
          >
            {mode === 'continuous' ? (
              <Scroll className="w-4 h-4 text-blue-400" />
            ) : (
              <FileText className="w-4 h-4 text-emerald-400" />
            )}
          </button>

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
            aria-label="Cycle theme"
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-amber-400" />}
            {theme === 'sepia' && <BookOpen className="w-4 h-4 text-amber-500" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-sky-400" />}
          </button>

          {/* In-Page Note Button with Badge for Current Page */}
          <button
            type="button"
            onClick={() => openNotesForPage(currentPage)}
            className="relative p-2 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
            title={`Page notes (${currentNotesCount} notes on page ${currentPage})`}
            aria-label="Page notes"
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
            aria-label="Toggle favorite"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isFavorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-300 hover:text-white'
              }`}
            />
          </button>
        </div>
      </header>

      {/* Main Viewport Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable Viewport Container with Native Momentum Scrolling */}
        <div
          ref={viewportContainerRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: isZoomed ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom'
          }}
          className={`absolute inset-0 overflow-auto overscroll-contain transition-colors duration-300 ${viewportBgClass} ${
            isZoomed ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {/* Loading Spinner */}
          {isLoadingPdf && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
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
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : (
            /* Document Content Wrapper:
               min-w-full min-h-full w-max with margin: 0 auto guarantees:
               1) Centered pages when page width <= screen
               2) 360-degree free pan without flexbox clipping when zoomed in! */
            <div
              ref={contentWrapperRef}
              className="min-w-full min-h-full w-max flex flex-col items-center py-5 px-3"
              style={{
                margin: '0 auto',
                transform: gestureScale !== 1.0 ? `scale(${gestureScale})` : undefined,
                transformOrigin: `${pinchCenter.x}px ${pinchCenter.y}px`,
                transition: isPinching ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              {mode === 'continuous' ? (
                /* CONTINUOUS VERTICAL SCROLL MODE:
                   Renders pages 1 through totalPages sequentially in a vertical column.
                   Uses lazy placeholder aspect-ratio so fast thumb-fling scrolling has ZERO layout jumping! */
                Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const dims =
                    pageDimensionsRef.current.get(pageNum) || defaultDimsRef.current;
                  const displayWidth = Math.floor(dims.width * scale);
                  const displayHeight = Math.floor(dims.height * scale);
                  const isVisible = visiblePages.has(pageNum);
                  const pageNotes = notes.filter((n) => n.pageNumber === pageNum);

                  return (
                    <div
                      key={pageNum}
                      ref={(node) => {
                        if (node) {
                          pageElementsRef.current.set(pageNum, node);
                          if (observerRef.current) observerRef.current.observe(node);
                        } else {
                          pageElementsRef.current.delete(pageNum);
                        }
                      }}
                      data-page-number={pageNum}
                      className="relative flex flex-col items-center mb-6 last:mb-2 transition-shadow"
                      style={{
                        width: `${displayWidth}px`,
                        minHeight: `${displayHeight}px`
                      }}
                    >
                      {/* In-Page Header Strip: Page number & In-Page Note Badge */}
                      <div className="w-full flex items-center justify-between px-2 py-1 mb-1 text-xs">
                        <span className="font-semibold text-zinc-400 text-[11px] tracking-wide">
                          PAGE {pageNum}
                        </span>

                        <div className="flex items-center space-x-1.5">
                          {pageNotes.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNotesForPage(pageNum);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-[11px] shadow-sm active:scale-95 transition-all"
                              title={`View ${pageNotes.length} notes for page ${pageNum}`}
                            >
                              <span>📝</span>
                              <span>
                                {pageNotes.length} {pageNotes.length === 1 ? 'note' : 'notes'}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNotesForPage(pageNum);
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] active:scale-95 transition-all"
                              title={`Add note to page ${pageNum}`}
                            >
                              <StickyNote className="w-3 h-3 text-zinc-400" />
                              <span>+ Note</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Canvas or Exact Aspect Ratio Placeholder */}
                      <div
                        className={`relative rounded-lg overflow-hidden transition-all duration-150 ${canvasContainerClass}`}
                        style={{
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                          filter: canvasFilter,
                          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.35)'
                        }}
                      >
                        {isVisible ? (
                          <ContinuousPageCanvas
                            pdfDoc={pdfDocRef.current}
                            pageNumber={pageNum}
                            scale={scale}
                            width={displayWidth}
                            height={displayHeight}
                          />
                        ) : (
                          /* Offscreen lightweight placeholder: preserves exact dimensions so layout NEVER shifts */
                          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100/90 dark:bg-zinc-900/60 text-zinc-400">
                            <span className="text-xs font-semibold opacity-40">
                              Page {pageNum}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* SINGLE PAGE MODE:
                   Renders only currentPage with smooth horizontal swiping */
                (() => {
                  const dims =
                    pageDimensionsRef.current.get(currentPage) || defaultDimsRef.current;
                  const displayWidth = Math.floor(dims.width * scale);
                  const displayHeight = Math.floor(dims.height * scale);

                  return (
                    <div
                      className="relative flex flex-col items-center my-auto transition-shadow"
                      style={{
                        width: `${displayWidth}px`,
                        minHeight: `${displayHeight}px`
                      }}
                    >
                      <div
                        className={`relative rounded-lg overflow-hidden transition-all duration-150 ${canvasContainerClass}`}
                        style={{
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                          filter: canvasFilter,
                          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.35)'
                        }}
                      >
                        <ContinuousPageCanvas
                          pdfDoc={pdfDocRef.current}
                          pageNumber={currentPage}
                          scale={scale}
                          width={displayWidth}
                          height={displayHeight}
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* FAST-SCROLL PAGE SCRUBBER (Floating on Right Edge, Google Drive & Samsung Notes style) */}
        {mode === 'continuous' && totalPages > 1 && (
          <div
            ref={scrubberTrackRef}
            className={`absolute right-1 top-16 bottom-20 z-30 w-10 flex items-center justify-center select-none touch-none transition-opacity duration-300 ${
              isScrubbing || isScrolling ? 'opacity-100' : 'opacity-35 hover:opacity-100'
            }`}
            onTouchStart={handleScrubberTouchStart}
            onTouchMove={handleScrubberTouchMove}
            onTouchEnd={handleScrubberTouchEnd}
            onTouchCancel={handleScrubberTouchEnd}
            onMouseDown={handleScrubberMouseDown}
            aria-label="Fast scroll scrubber"
          >
            {/* Scrubber Track Bar */}
            <div className="w-1.5 h-full bg-zinc-700/60 hover:bg-zinc-600 rounded-full backdrop-blur-sm shadow-inner transition-colors" />

            {/* Draggable Handle Pill */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-[transform,shadow] duration-75 ${
                isScrubbing ? 'scale-110 shadow-2xl ring-2 ring-blue-400' : 'hover:scale-105 shadow-lg'
              }`}
              style={{
                top: `calc(${((currentPage - 1) / (totalPages - 1 || 1)) * 100}% - 14px)`,
                height: '28px',
                width: '28px'
              }}
            >
              <div className="w-6 h-7 rounded-full bg-blue-600 text-white flex flex-col items-center justify-center border border-blue-400/80 shadow-md">
                <div className="w-2.5 h-0.5 bg-white/80 rounded-full mb-0.5" />
                <div className="w-2.5 h-0.5 bg-white/80 rounded-full" />
              </div>

              {/* Floating Page Number Callout Bubble */}
              {(isScrubbing || isScrolling) && (
                <div className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/95 border border-zinc-700 text-white shadow-2xl backdrop-blur-md whitespace-nowrap animate-in fade-in zoom-in-90 pointer-events-none">
                  <span className="text-xs font-bold">
                    Page {currentPage} of {totalPages}
                  </span>
                  {notes.filter((n) => n.pageNumber === currentPage).length > 0 && (
                    <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-black">
                      <span>📝</span>
                      <span>{notes.filter((n) => n.pageNumber === currentPage).length}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Zoom & Fit Controls HUD (Pinned at Bottom-Right) */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center bg-zinc-950/95 backdrop-blur-md border border-zinc-700/80 rounded-full shadow-2xl p-1 text-zinc-200 space-x-1">
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

          {/* One-tap Fit Width / Fit Page toggle button */}
          <button
            type="button"
            onClick={toggleFitMode}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white active:scale-95 transition-all border border-zinc-700/60 shadow-sm"
            title={
              fitMode === 'width'
                ? 'Currently Fit Width. Tap to Fit Page'
                : 'Currently Fit Page. Tap to Fit Width'
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

      {/* Bottom Controls Bar */}
      <footer className="relative z-20 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 text-zinc-100 px-4 py-2 pb-safe flex flex-col space-y-2 shadow-lg">
        {/* Quick Note Indicator Pill for Current Page */}
        {currentNotesCount > 0 ? (
          <button
            type="button"
            onClick={() => openNotesForPage(currentPage)}
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
            onClick={() => openNotesForPage(currentPage)}
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
              onChange={(e) => scrollToPage(Number(e.target.value), 'auto')}
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
        pageNumber={activeNotePage}
        initialNotes={notes}
        onNotesChange={loadDocumentNotes}
      />
    </div>
  );
};
