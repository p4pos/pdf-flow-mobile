import React from 'react';
import { 
  BookOpen, 
  StickyNote, 
  Folder, 
  Star, 
  LucideIcon 
} from 'lucide-react';

export type TabType = 'library' | 'notes' | 'groups' | 'favorites';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

export interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  badgeCounts?: Partial<Record<TabType, number>>;
  className?: string;
}

const TABS: TabConfig[] = [
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'notes', label: 'All Notes', icon: StickyNote },
  { id: 'groups', label: 'Groups', icon: Folder },
  { id: 'favorites', label: 'Favorites', icon: Star },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  badgeCounts = {},
  className = '',
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Main Navigation"
      className={`glass-tabbar fixed bottom-0 left-0 right-0 z-30 pb-safe select-none transition-all duration-200 ${className}`}
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = badgeCounts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-1 relative group focus:outline-none transition-transform duration-150 active:scale-95"
              aria-label={`${tab.label} tab`}
              aria-selected={isActive}
              role="tab"
            >
              {/* Material You Pill Indicator / Icon Container */}
              <div
                className={`relative px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-600/12 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                  } ${tab.id === 'favorites' && isActive ? 'fill-current' : ''}`}
                />

                {/* Badge Count */}
                {count !== undefined && count > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-xs ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>

              {/* Tab Label */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-colors duration-200 ${
                  isActive
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : 'font-medium text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
