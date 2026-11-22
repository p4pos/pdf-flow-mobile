import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  Folder, 
  Search, 
  AlertTriangle,
  FileText,
  Sparkles
} from 'lucide-react';
import { DocumentGroup, PdfDocument } from '../../types';
import { getAllGroups, saveGroup, deleteGroup, getAllDocuments, updateDocumentMeta, DEFAULT_GROUPS } from '../../services/db';
import { COVER_ICONS, getCoverIcon } from '../library/coverIcons';

export interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupsChanged?: () => void;
  selectedGroupId?: string;
  onSelectGroup?: (groupId: string) => void;
}

const PRESET_COLORS = [
  '#007AFF', // Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#00C7BE', // Teal
  '#32ADE6', // Sky
  '#FF3B30', // Red
  '#EAB308', // Amber / Yellow
  '#64748B', // Slate
  '#10B981', // Emerald
];

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  onGroupsChanged,
  selectedGroupId,
  onSelectGroup,
}) => {
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Form mode: null = list mode, 'create' = new, 'edit' = editing existing
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('Folder');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [groupToDelete, setGroupToDelete] = useState<DocumentGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load groups and calculate document counts
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allGroups, allDocs] = await Promise.all([
        getAllGroups(),
        getAllDocuments(),
      ]);

      setGroups(allGroups);

      // Compute document count per group
      const counts: Record<string, number> = {};
      allDocs.forEach((doc) => {
        if (doc.groupId) {
          counts[doc.groupId] = (counts[doc.groupId] || 0) + 1;
        }
      });
      setDocCounts(counts);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setFormMode(null);
      setGroupToDelete(null);
      setSearchQuery('');
      setFormError('');
    }
  }, [isOpen]);

  const handleOpenCreate = () => {
    setName('');
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setIcon('Folder');
    setDescription('');
    setFormError('');
    setEditingGroupId(null);
    setFormMode('create');
  };

  const handleOpenEdit = (group: DocumentGroup) => {
    setName(group.name);
    setColor(group.color);
    setIcon(group.icon || 'Folder');
    setDescription(group.description || '');
    setFormError('');
    setEditingGroupId(group.id);
    setFormMode('edit');
  };

  const handleCancelForm = () => {
    setFormMode(null);
    setEditingGroupId(null);
    setFormError('');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Please enter a group name');
      return;
    }

    try {
      const id = formMode === 'edit' && editingGroupId 
        ? editingGroupId 
        : `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newGroup: DocumentGroup = {
        id,
        name: trimmed,
        color,
        icon,
        description: description.trim() || undefined,
      };

      await saveGroup(newGroup);
      await loadData();
      setFormMode(null);
      setEditingGroupId(null);
      onGroupsChanged?.();
    } catch (err: any) {
      console.error('Failed to save group:', err);
      setFormError('Failed to save group. Please try again.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      const targetId = groupToDelete.id;
      await deleteGroup(targetId);

      // Unassign documents from this deleted group
      const allDocs = await getAllDocuments();
      const docsInGroup = allDocs.filter((d) => d.groupId === targetId);
      for (const doc of docsInGroup) {
        await updateDocumentMeta(doc.id, { groupId: undefined });
      }

      await loadData();
      setGroupToDelete(null);
      onGroupsChanged?.();
    } catch (err) {
      console.error('Failed to delete group:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-manager-title"
        className="glass-modal relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-200"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Folder className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="group-manager-title" className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                {formMode === 'create' ? 'Create New Group' : formMode === 'edit' ? 'Edit Group' : 'Manage Groups'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formMode ? 'Customize group identity & color' : `${groups.length} categories configured`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {formMode ? (
            /* CREATE / EDIT FORM */
            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/60">
                <div className="text-[11px] font-semibold tracking-wider text-gray-400 dark:text-gray-500 uppercase mb-2">
                  Live Preview
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md transition-all duration-150"
                    style={{ backgroundColor: color }}
                  >
                    {React.createElement(getCoverIcon(icon), { className: 'w-6 h-6 stroke-[2]' })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {name.trim() || 'Untitled Group'}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {description.trim() || 'No description provided'}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-600">
                    Preview
                  </span>
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. Work, Medical, Invoices, Books..."
                  autoFocus
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all"
                />
                {formError && (
                  <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {formError}
                  </p>
                )}
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Tax filings, warranties & receipts"
                  maxLength={80}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all"
                />
              </div>

              {/* Color Swatch Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Accent Color
                </label>
                <div className="grid grid-cols-6 gap-2.5">
                  {PRESET_COLORS.map((c) => {
                    const isSelected = color.toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="h-10 rounded-xl flex items-center justify-center transition-transform active:scale-90 relative shadow-xs"
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                      >
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-black/25 flex items-center justify-center text-white">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select Icon
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800">
                  {COVER_ICONS.map((item) => {
                    const isSelected = icon === item.id;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm scale-102 font-bold'
                            : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                        }`}
                        title={item.label}
                      >
                        <IconComp className="w-5 h-5 stroke-[2]" />
                        <span className="text-[10px] mt-1 truncate max-w-full">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  {formMode === 'create' ? 'Create Group' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* GROUP LIST MODE */
            <div className="space-y-3.5">
              {/* Top Action Bar: Search & New Group Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter groups..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>New Group</span>
                </button>
              </div>

              {/* Group Cards */}
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs">Loading groups...</span>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="py-10 text-center text-gray-400 dark:text-gray-500">
                  <Folder className="w-10 h-10 mx-auto mb-2 stroke-[1.5] opacity-50" />
                  <p className="text-sm font-medium">No groups found</p>
                  <p className="text-xs mt-0.5">
                    {searchQuery ? 'Try another search query' : 'Create your first group to organize your PDFs'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGroups.map((group) => {
                    const count = docCounts[group.id] || 0;
                    const IconComponent = getCoverIcon(group.icon);
                    const isSelected = selectedGroupId === group.id;

                    return (
                      <div
                        key={group.id}
                        className={`group p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                            : 'bg-gray-50/80 dark:bg-zinc-800/50 hover:bg-gray-100/80 dark:hover:bg-zinc-800 border-gray-200/60 dark:border-zinc-700/60'
                        }`}
                      >
                        {/* Group Info (Clickable if onSelectGroup is provided) */}
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            if (onSelectGroup) {
                              onSelectGroup(group.id);
                              onClose();
                            }
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                            style={{ backgroundColor: group.color }}
                          >
                            <IconComponent className="w-5 h-5 stroke-[2]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {group.name}
                              </h4>
                              {isSelected && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-600 text-white shrink-0">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3 opacity-70" />
                                {count} {count === 1 ? 'PDF' : 'PDFs'}
                              </span>
                              {group.description && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{group.description}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(group)}
                            className="w-8 h-8 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 flex items-center justify-center transition-colors"
                            title="Edit group"
                            aria-label={`Edit ${group.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5 stroke-[2]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setGroupToDelete(group)}
                            className="w-8 h-8 rounded-lg text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                            title="Delete group"
                            aria-label={`Delete ${group.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog Overlay */}
        {groupToDelete && (
          <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-700 shadow-xl space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Delete &ldquo;{groupToDelete.name}&rdquo;?
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {docCounts[groupToDelete.id]
                    ? `${docCounts[groupToDelete.id]} document(s) in this group will become unorganized.`
                    : 'This group contains no documents.'}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGroupToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
