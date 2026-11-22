import React, { useState } from 'react';
import {
  MoreVertical,
  Heart,
  FileText,
  StickyNote,
  Lock,
  Layers,
  HardDrive
} from 'lucide-react';
import { PdfDocument, DocumentGroup, ViewMode } from '../../types';
import { formatFileSize, formatDate } from '../../utils/formatters';
import { getCoverIcon, resolveGradientClass } from './coverIcons';

export interface DocumentCardProps {
  document: PdfDocument;
  viewMode?: ViewMode;
  group?: DocumentGroup;
  notesCount?: number;
  onOpen: (document: PdfDocument) => void;
  onMenuClick: (document: PdfDocument, e: React.MouseEvent) => void;
  onToggleFavorite?: (document: PdfDocument, e: React.MouseEvent) => void;
  onPreviewNotes?: (document: PdfDocument, e: React.MouseEvent) => void;
  className?: string;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  viewMode = 'grid',
  group,
  notesCount = 0,
  onOpen,
  onMenuClick,
  onToggleFavorite,
  onPreviewNotes,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Gradient Cover Render Helper
  const renderCover = (isCompact = false) => {
    const isGradient = doc.coverType === 'gradient' || (!doc.coverData && doc.coverType !== 'image');
    const isImageOrPage = (doc.coverType === 'image' || doc.coverType === 'page') && doc.coverData && !imageError;

    if (isImageOrPage && doc.coverData) {
      return (
        <div className="relative w-full h-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <img
            src={doc.coverData}
            alt={doc.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {/* Subtle realistic book spine shadow */}
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/35 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute inset-0 ring-1 ring-inset ring-black/10 dark:ring-white/10 rounded-[inherit] pointer-events-none" />
        </div>
      );
    }

    if (isGradient) {
      const gradientClass = resolveGradientClass(doc.coverColor);
      const IconComponent = getCoverIcon(doc.coverData);

      return (
        <div
          className={`relative w-full h-full bg-gradient-to-br ${gradientClass} p-3 sm:p-4 flex flex-col justify-between text-white overflow-hidden select-none transition-transform duration-300 group-hover:scale-[1.02]`}
        >
          {/* Subtle book spine depth */}
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" />
          {/* Apple Books subtle sheen */}
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/15 rounded-full blur-xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="relative z-10">
            <div
              className={`rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner ${
                isCompact ? 'w-8 h-8 rounded-lg' : 'w-11 h-11 sm:w-12 sm:h-12'
              }`}
            >
              <IconComponent className={isCompact ? 'w-4 h-4' : 'w-6 h-6'} />
            </div>
          </div>

          {/* Title on cover */}
          <div className="relative z-10 mt-auto">
            <h4
              className={`font-bold tracking-tight text-white drop-shadow-sm leading-snug line-clamp-3 ${
                isCompact ? 'text-[11px]' : 'text-sm sm:text-base font-serif'
              }`}
            >
              {doc.title}
            </h4>
            {!isCompact && (
              <p className="text-[11px] text-white/80 font-medium mt-1 tracking-wide">
                {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
              </p>
            )}
          </div>

          <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[inherit] pointer-events-none" />
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-slate-700 to-zinc-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <FileText className="w-10 h-10 text-white/60 mb-2" />
        <span className="text-xs font-semibold text-white/80 line-clamp-2 px-1">
          {doc.title}
        </span>
      </div>
    );
  };

  // -----------------------
  // LIST VIEW
  // -----------------------
  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(doc)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(doc)}
        className={`group flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-ios-darkCard border border-gray-100 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer text-left ${className}`}
      >
        {/* Cover Thumbnail */}
        <div className="relative w-16 h-22 sm:w-20 sm:h-28 aspect-[3/4] rounded-xl overflow-hidden shrink-0 shadow-md">
          {renderCover(true)}

          {/* Hidden Badge */}
          {doc.isHidden && (
            <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-sm text-amber-400 p-1 rounded-md shadow-sm">
              <Lock className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm sm:text-base line-clamp-2 leading-snug">
                {doc.title}
              </h3>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {/* Group Badge */}
              {group && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="truncate max-w-[100px]">{group.name}</span>
                </span>
              )}

              {/* Notes Count Badge */}
              {notesCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewNotes?.(doc, e);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 transition-colors"
                  title="View notes on this document"
                >
                  <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>
                    {notesCount} {notesCount === 1 ? 'note' : 'notes'}
                  </span>
                </button>
              )}

              {/* Hidden Pill */}
              {doc.isHidden && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-amber-400">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Hidden</span>
                </span>
              )}
            </div>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mt-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 opacity-70" />
                {doc.pageCount} pgs
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 opacity-70" />
                {formatFileSize(doc.fileSize)}
              </span>
              {doc.dateAdded && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{formatDate(doc.dateAdded)}</span>
                </>
              )}
            </div>

            {/* Favorite & Actions */}
            <div className="flex items-center gap-1">
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, e);
                  }}
                  aria-label={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-rose-500 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      doc.isFavorite
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClick(doc, e);
                }}
                aria-label="Document options"
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------
  // GRID VIEW (Default)
  // -----------------------
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(doc)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(doc)}
      className={`group flex flex-col bg-white dark:bg-ios-darkCard rounded-2xl p-2.5 sm:p-3 border border-gray-100 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer text-left ${className}`}
    >
      {/* Cover Container */}
      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-md">
        {renderCover(false)}

        {/* Favorite Heart Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(doc, e);
            }}
            aria-label={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all shadow-sm ${
              doc.isFavorite
                ? 'bg-white/95 dark:bg-zinc-900/90 text-rose-500'
                : 'bg-black/35 hover:bg-black/55 text-white/90'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                doc.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'
              }`}
            />
          </button>
        )}

        {/* Hidden Indicator Badge */}
        {doc.isHidden && (
          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-400 px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm">
            <Lock className="w-3 h-3" />
            <span>Hidden</span>
          </div>
        )}

        {/* Bottom Cover Gradient Pill with Page Count */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="bg-black/60 backdrop-blur-md text-white/95 text-[10px] font-medium px-2 py-0.5 rounded-md shadow-sm">
            {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
          </span>
          <span className="bg-black/60 backdrop-blur-md text-white/95 text-[10px] font-medium px-2 py-0.5 rounded-md shadow-sm">
            {formatFileSize(doc.fileSize)}
          </span>
        </div>
      </div>

      {/* Title & Metadata Under Cover */}
      <div className="flex flex-col mt-2.5 px-0.5 flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between gap-1">
            <h3
              className="font-semibold text-gray-900 dark:text-zinc-100 text-sm line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              title={doc.title}
            >
              {doc.title}
            </h3>

            {/* 3-dot Menu Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(doc, e);
              }}
              aria-label="Document options"
              className="p-1 -mr-1 -mt-0.5 rounded-full text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Group and Notes badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {group && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="truncate max-w-[85px]">{group.name}</span>
              </span>
            )}

            {notesCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewNotes?.(doc, e);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 transition-colors"
                title="Preview notes"
              >
                <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>
                  {notesCount} {notesCount === 1 ? 'note' : 'notes'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Date Row */}
        <div className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500 truncate">
          {doc.dateAdded ? formatDate(doc.dateAdded) : ''}
        </div>
      </div>
    </div>
  );
};
