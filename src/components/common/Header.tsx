import React, { useRef } from 'react';
import { 
  FileText, 
  Search, 
  X, 
  LayoutGrid, 
  List, 
  Settings, 
  Eye, 
  Lock, 
  ShieldCheck
} from 'lucide-react';
import { ViewMode, VisibilityFilter } from '../../types';

export interface HeaderProps {
  title?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeToggle: () => void;
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (filter: VisibilityFilter) => void;
  onOpenSettings: () => void;
  hiddenCount?: number;
  totalCount?: number;
  placeholder?: string;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'PDF Flow',
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeToggle,
  visibilityFilter,
  onVisibilityFilterChange,
  onOpenSettings,
  hiddenCount = 0,
  totalCount,
  placeholder = 'Search documents, notes, tags...',
  className = '',
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cycle visibility filter: all -> visible -> hidden -> all
  const cycleVisibilityFilter = () => {
    if (visibilityFilter === 'all') {
      onVisibilityFilterChange('visible');
    } else if (visibilityFilter === 'visible') {
      onVisibilityFilterChange('hidden');
    } else {
      onVisibilityFilterChange('all');
    }
  };

  const clearSearch = () => {
    onSearchChange('');
    searchInputRef.current?.focus();
  };

  // Visibility button configuration based on active filter
  const getVisibilityConfig = () => {
    switch (visibilityFilter) {
      case 'hidden':
        return {
          icon: Lock,
          label: 'Vault',
          badgeText: hiddenCount > 0 ? `${hiddenCount}` : '🔒',
          containerClass: 'bg-amber-500/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
          indicatorDot: 'bg-amber-500',
        };
      case 'visible':
        return {
          icon: ShieldCheck,
          label: 'Visible',
          badgeText: 'Public',
          containerClass: 'bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
          indicatorDot: 'bg-blue-500',
        };
      case 'all':
      default:
        return {
          icon: Eye,
          label: 'All',
          badgeText: totalCount !== undefined ? `${totalCount}` : 'All',
          containerClass: 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 border-black/[0.06] dark:border-white/[0.08]',
          indicatorDot: 'bg-gray-400 dark:bg-gray-500',
        };
    }
  };

  const visConfig = getVisibilityConfig();
  const VisibilityIcon = visConfig.icon;

  return (
    <header className={`glass-nav sticky top-0 z-30 pt-safe px-4 py-3 transition-all duration-200 select-none ${className}`}>
      {/* Top Bar: Brand Logo, Title & Action Controls */}
      <div className="flex items-center justify-between gap-2 h-11">
        {/* App Logo & Title */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0">
            <FileText className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
              {title}
            </h1>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 rounded-full tracking-wide shrink-0">
              PRO
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Visibility / Vault Filter Toggle */}
          <button
            type="button"
            onClick={cycleVisibilityFilter}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${visConfig.containerClass}`}
            title={`Current view: ${visibilityFilter}. Tap to switch filter.`}
            aria-label={`Visibility filter: currently showing ${visibilityFilter}`}
          >
            <VisibilityIcon className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="text-xs font-semibold">{visConfig.label}</span>
            <span className="text-[10px] opacity-75 font-mono px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded-md">
              {visConfig.badgeText}
            </span>
          </button>

          {/* View Mode Toggle Button */}
          <button
            type="button"
            onClick={onViewModeToggle}
            className="w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/[0.08] text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all duration-150 active:scale-95"
            title={`Switch to ${viewMode === 'grid' ? 'List' : 'Grid'} view`}
            aria-label={`Toggle view mode. Currently ${viewMode}`}
          >
            {viewMode === 'grid' ? (
              <LayoutGrid className="w-4 h-4 stroke-[2]" />
            ) : (
              <List className="w-4 h-4 stroke-[2]" />
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/[0.08] text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all duration-150 active:scale-95"
            title="Open App Settings"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Modern iOS Search Bar with Clear Button & Smooth Focus */}
      <div className="mt-2 pb-0.5">
        <div className="relative flex items-center bg-black/[0.05] dark:bg-white/[0.07] rounded-xl px-3 py-2 text-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:bg-white dark:focus-within:bg-zinc-800/90 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent border-0 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 text-sm leading-tight"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 -mr-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search query"
            >
              <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-zinc-600 flex items-center justify-center text-white dark:text-zinc-300">
                <X className="w-3 h-3 stroke-[2.5]" />
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
