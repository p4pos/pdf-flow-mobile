import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, Check, FolderPlus } from 'lucide-react';
import { PdfDocument, DocumentGroup } from '../../types';
import { getAllGroups, saveGroup, updateDocumentMeta } from '../../services/db';

export interface ChangeGroupModalProps {
  isOpen: boolean;
  document: PdfDocument | null;
  onClose: () => void;
  onDocumentUpdated?: (updatedDoc: PdfDocument) => void;
}

const PRESET_GROUP_COLORS = [
  '#007AFF', // Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#00C7BE', // Teal
  '#8E8E93'  // Gray
];

export const ChangeGroupModal: React.FC<ChangeGroupModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onDocumentUpdated,
}) => {
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(PRESET_GROUP_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && doc) {
      setSelectedGroupId(doc.groupId);
      setIsCreatingNew(false);
      setNewGroupName('');
      getAllGroups().then(setGroups).catch(console.error);
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleSelect = async (groupId: string | undefined) => {
    setIsSaving(true);
    try {
      await updateDocumentMeta(doc.id, { groupId });
      const updated = { ...doc, groupId };
      onDocumentUpdated?.(updated);
      onClose();
    } catch (e) {
      console.error('Failed to change group:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGroupName.trim();
    if (!cleanName) return;

    setIsSaving(true);
    try {
      const newGroup: DocumentGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        color: newGroupColor,
      };
      await saveGroup(newGroup);
      setGroups((prev) => [...prev, newGroup]);
      await handleSelect(newGroup.id);
    } catch (e) {
      console.error('Failed to create group:', e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-[28px] sm:rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Move to Group
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Unassigned / None */}
          <button
            type="button"
            onClick={() => handleSelect(undefined)}
            disabled={isSaving}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
              !selectedGroupId
                ? 'bg-blue-50/70 border-blue-500/80 text-blue-900 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-200'
                : 'bg-gray-50/60 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full border border-dashed border-gray-400 dark:border-zinc-500" />
              <span className="text-sm font-semibold">No Group (Unassigned)</span>
            </div>
            {!selectedGroupId && <Check className="w-4 h-4 text-blue-600" />}
          </button>

          {/* Existing Groups */}
          {groups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleSelect(group.id)}
                disabled={isSaving}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-500/80 text-blue-900 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-200'
                    : 'bg-gray-50/60 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <h5 className="text-sm font-semibold">{group.name}</h5>
                    {group.description && (
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            );
          })}

          {/* Create New Group Toggle */}
          {!isCreatingNew ? (
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-xs font-semibold transition-colors mt-2"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create New Group</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateGroup}
              className="p-3.5 bg-gray-50 dark:bg-zinc-800/70 rounded-2xl border border-gray-200 dark:border-zinc-700 space-y-3 mt-2"
            >
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                New Group
              </span>
              <input
                type="text"
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g. Taxes, Projects)"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Color swatches */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Color:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewGroupColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        newGroupColor === c ? 'scale-125 ring-2 ring-blue-500' : 'opacity-80'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || isSaving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Create & Move
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900 flex justify-end pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
