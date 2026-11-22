import React, { useRef } from 'react';
import { 
  Files, 
  Folder, 
  Briefcase, 
  GraduationCap, 
  Receipt, 
  User, 
  FolderKanban, 
  Plus, 
  LucideIcon 
} from 'lucide-react';
import { DocumentGroup } from '../../types';

export interface GroupChipsProps {
  groups: DocumentGroup[];
  selectedGroupId: string | null; // null or 'all' indicates All Documents
  onSelectGroup: (groupId: string | null) => void;
  groupCounts?: Record<string, number>;
  totalCount?: number;
  onAddGroup?: () => void;
  className?: string;
}

// Icon resolver helper based on group configuration
const resolveGroupIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return Folder;
  const name = iconName.toLowerCase().trim();
  switch (name) {
    case 'briefcase':
    case 'work':
      return Briefcase;
    case 'graduationcap':
    case 'study':
    case 'books':
      return GraduationCap;
    case 'receipt':
    case 'finance':
    case 'bills':
      return Receipt;
    case 'user':
    case 'personal':
      return User;
    case 'kanban':
    case 'folderkanban':
      return FolderKanban;
    default:
      return Folder;
  }
};

export const GroupChips: React.FC<GroupChipsProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  groupCounts = {},
  totalCount,
  onAddGroup,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const isAllActive = selectedGroupId === null || selectedGroupId === 'all';
  const allDocCount = totalCount !== undefined ? totalCount : groupCounts['all'];

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-x-auto no-scrollbar scroll-smooth py-2 px-4 select-none ${className}`}
      role="region"
      aria-label="Document Groups"
    >
      <div className="flex items-center space-x-2 min-w-max">
        {/* 'All Documents' Primary Chip */}
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={`h-8 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
            isAllActive
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-600/30'
              : 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.05] dark:border-white/[0.06]'
          }`}
          aria-pressed={isAllActive}
        >
          <Files className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>All Documents</span>
          {allDocCount !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${
                isAllActive
                  ? 'bg-white/25 text-white'
                  : 'bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400'
              }`}
            >
              {allDocCount}
            </span>
          )}
        </button>

        {/* Dynamic Group Chips */}
        {groups.map((group) => {
          const isActive = selectedGroupId === group.id;
          const GroupIcon = resolveGroupIcon(group.icon);
          const count = groupCounts[group.id];

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-white shadow-sm ring-2 ring-black/10 dark:ring-white/10'
                  : 'bg-black/[0.04] dark:bg-white/[0.07] text-gray-700 dark:text-gray-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.05] dark:border-white/[0.06]'
              }`}
              style={{
                backgroundColor: isActive ? group.color : undefined,
              }}
              aria-pressed={isActive}
            >
              {/* Colored Dot or Icon */}
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-opacity ${
                  isActive ? 'bg-white' : ''
                }`}
                style={{
                  backgroundColor: !isActive ? group.color : undefined,
                }}
              />
              <GroupIcon className="w-3.5 h-3.5 stroke-[2]" />
              <span className="truncate max-w-[120px]">{group.name}</span>

              {/* Group Document Count Badge */}
              {count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* "+ New Group" Action Chip */}
        {onAddGroup && (
          <button
            type="button"
            onClick={onAddGroup}
            className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1 border border-dashed border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all duration-150 active:scale-95"
            aria-label="Create new document group"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>New Group</span>
          </button>
        )}
      </div>
    </div>
  );
};
