import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Moon, 
  Sun, 
  BookOpen, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  Download, 
  Upload, 
  RotateCcw, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Loader2, 
  Eye, 
  LayoutGrid, 
  List, 
  Info,
  Database,
  Layers
} from 'lucide-react';
import { AppSettings, ReaderTheme, ViewMode } from '../../types';
import { getSettings, saveSettings, getAllDocuments, getAllNotes, getAllGroups } from '../../services/db';
import { downloadBackup, importBackup, resetAllData } from '../../services/backupService';
import { seedSampleDataIfEmpty } from '../../services/sampleData';
import { PinLockModal } from '../privacy/PinLockModal';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
  onRequestSetPin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    defaultViewMode: 'grid',
    showHidden: false,
    autoExtractCover: true,
  });

  const [stats, setStats] = useState<{ docs: number; notes: number; groups: number }>({
    docs: 0,
    notes: 0,
    groups: 0,
  });

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Status feedback toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Internal PIN modal controller
  const [pinModalState, setPinModalState] = useState<{
    isOpen: boolean;
    mode: 'set' | 'change' | 'unlock';
  }>({
    isOpen: false,
    mode: 'set',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current settings and stats
  const refreshData = async () => {
    try {
      const [currentSettings, docs, notes, groups] = await Promise.all([
        getSettings(),
        getAllDocuments(),
        getAllNotes(),
        getAllGroups(),
      ]);
      setSettings(currentSettings);
      setStats({
        docs: docs.length,
        notes: notes.length,
        groups: groups.length,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      setFeedback(null);
      setShowResetConfirm(false);
    }
  }, [isOpen]);

  // Apply theme to DOM
  const handleThemeChange = async (theme: ReaderTheme) => {
    const updated: AppSettings = { ...settings, theme };
    setSettings(updated);
    await saveSettings(updated);

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('sepia');
    } else if (theme === 'sepia') {
      root.classList.remove('dark');
      root.classList.add('sepia');
    } else {
      root.classList.remove('dark');
      root.classList.remove('sepia');
    }

    onSettingsChanged?.();
  };

  // Toggle default view mode
  const handleViewModeChange = async (mode: ViewMode) => {
    const updated: AppSettings = { ...settings, defaultViewMode: mode };
    setSettings(updated);
    await saveSettings(updated);
    onSettingsChanged?.();
  };

  // Toggle auto cover extraction
  const handleToggleAutoCover = async () => {
    const updated: AppSettings = { ...settings, autoExtractCover: !settings.autoExtractCover };
    setSettings(updated);
    await saveSettings(updated);
    onSettingsChanged?.();
  };

  // Toggle show hidden documents
  const handleToggleShowHidden = async () => {
    // If turning on and PIN is set, request PIN verification
    if (!settings.showHidden && settings.pinCode) {
      setPinModalState({ isOpen: true, mode: 'unlock' });
      return;
    }

    const updated: AppSettings = { ...settings, showHidden: !settings.showHidden };
    setSettings(updated);
    await saveSettings(updated);
    onSettingsChanged?.();
  };

  // Remove security PIN
  const handleRemovePin = async () => {
    const updated: AppSettings = { ...settings, pinCode: undefined };
    setSettings(updated);
    await saveSettings(updated);
    setFeedback({ type: 'success', message: 'Vault PIN removed successfully.' });
    onSettingsChanged?.();
  };

  // Export database backup
  const handleExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setFeedback(null);
    try {
      await downloadBackup();
      setFeedback({ type: 'success', message: 'Backup file downloaded successfully!' });
    } catch (err: any) {
      console.error('Export failed:', err);
      setFeedback({ type: 'error', message: 'Failed to export backup. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Import backup file
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const result = await importBackup(text);

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Restored ${result.docCount} documents, ${result.noteCount} notes, and ${result.groupCount} groups!`,
        });
        await refreshData();
        onSettingsChanged?.();
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'Failed to restore backup.',
        });
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setFeedback({ type: 'error', message: 'Invalid backup JSON file.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset database
  const handleResetData = async (reseedDemo: boolean = true) => {
    setIsResetting(true);
    setFeedback(null);
    try {
      await resetAllData();
      if (reseedDemo) {
        await seedSampleDataIfEmpty();
      }
      await refreshData();
      setShowResetConfirm(false);
      setFeedback({
        type: 'success',
        message: reseedDemo
          ? 'Data reset successfully! Demo guide restored.'
          : 'All documents and notes cleared.',
      });
      onSettingsChanged?.();
    } catch (err) {
      console.error('Reset failed:', err);
      setFeedback({ type: 'error', message: 'Failed to reset application data.' });
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Dimmed backdrop */}
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal / Sheet Surface */}
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          className="glass-modal relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-200"
        >
          {/* Mobile Handle */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Database className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h2 id="settings-title" className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  Preferences & Settings
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Theme, Privacy Vault, and Data Backup
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors active:scale-95"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Feedback Banner */}
            {feedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800'
                }`}
              >
                <span>{feedback.message}</span>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SECTION 1: APPEARANCE & THEME */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                Appearance & Reader
              </h3>
              
              {/* Theme selector pills */}
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                {/* Light */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                    settings.theme === 'light'
                      ? 'border-blue-500 bg-blue-50/70 text-blue-700 font-bold ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500 stroke-[2]" />
                  <span className="text-xs font-medium">Light</span>
                </button>

                {/* Dark */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                    settings.theme === 'dark'
                      ? 'border-blue-500 bg-zinc-800 text-blue-400 font-bold ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <Moon className="w-5 h-5 text-indigo-400 stroke-[2]" />
                  <span className="text-xs font-medium">Dark</span>
                </button>

                {/* Sepia */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('sepia')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                    settings.theme === 'sepia'
                      ? 'border-amber-600 bg-amber-50 text-amber-800 font-bold ring-2 ring-amber-600/20 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-amber-700 stroke-[2]" />
                  <span className="text-xs font-medium">Sepia</span>
                </button>
              </div>

              {/* Default View Mode & Auto Cover */}
              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/70 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {settings.defaultViewMode === 'grid' ? (
                      <LayoutGrid className="w-4 h-4 text-blue-500" />
                    ) : (
                      <List className="w-4 h-4 text-blue-500" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                        Default Library View
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Initial layout when opening app
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center bg-gray-200 dark:bg-zinc-700 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('grid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        settings.defaultViewMode === 'grid'
                          ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('list')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        settings.defaultViewMode === 'list'
                          ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      List
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/70 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                        Auto Generate Covers
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Render first page thumbnail upon import
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleAutoCover}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.autoExtractCover ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.autoExtractCover ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: PRIVACY & SECRET VAULT */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                Privacy Vault Security
              </h3>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/70 dark:border-zinc-800 space-y-3">
                {/* Vault Status Banner */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {settings.pinCode ? (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gray-200/80 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        {settings.pinCode ? 'Vault PIN Protected' : 'Vault Unprotected'}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {settings.pinCode
                          ? '4-digit PIN is active'
                          : 'Anyone can view hidden documents'}
                      </p>
                    </div>
                  </div>

                  {/* Actions for PIN */}
                  <div className="flex items-center gap-1.5">
                    {settings.pinCode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPinModalState({ isOpen: true, mode: 'change' })}
                          className="px-2.5 py-1.5 rounded-xl bg-gray-200 dark:bg-zinc-700 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-300 transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePin}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPinModalState({ isOpen: true, mode: 'set' })}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Set PIN</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Show Hidden PDFs Toggle */}
                <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 block leading-tight">
                        Show Hidden Documents
                      </span>
                      <span className="text-[10px] text-gray-500">
                        Display secret documents in main library
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleShowHidden}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.showHidden ? 'bg-amber-500' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.showHidden ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 3: BACKUP & RESTORE */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                Data Backup & Restore
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-all active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Export Backup
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Save JSON copy of all PDFs & notes
                  </p>
                </button>

                {/* Import Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-all active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                    Restore Backup
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Load backup JSON file into app
                  </p>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
            </div>

            {/* SECTION 4: RESET / CLEANUP */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                Maintenance
              </h3>

              {showResetConfirm ? (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-700 dark:text-red-300">
                        Reset Application Storage?
                      </h4>
                      <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5 leading-snug">
                        This action will clear all saved PDF documents and notes stored on this device.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-1.5 px-3 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetData(true)}
                      disabled={isResetting}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1"
                    >
                      {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>Reset & Demo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full p-3 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/50 flex items-center justify-between text-xs text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4" />
                    <span className="font-semibold">Reset / Clear Sample Data</span>
                  </div>
                  <span className="text-[10px] text-gray-400">Restore fresh state</span>
                </button>
              )}
            </div>

            {/* SECTION 5: APP STATS & VERSION */}
            <div className="pt-2 pb-1 text-center border-t border-gray-100 dark:border-zinc-800 text-[11px] text-gray-400 dark:text-gray-500 space-y-1">
              <p>
                PDF Flow Mobile • {stats.docs} documents • {stats.notes} notes • {stats.groups} groups
              </p>
              <p className="text-[10px] opacity-75">
                Offline-First IndexedDB Storage • PWA Enabled
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded PIN Modal for Setting or Changing Vault PIN */}
      {pinModalState.isOpen && (
        <PinLockModal
          isOpen={pinModalState.isOpen}
          mode={pinModalState.mode}
          onClose={() => setPinModalState({ isOpen: false, mode: 'set' })}
          onSuccess={async () => {
            setPinModalState({ isOpen: false, mode: 'set' });
            if (pinModalState.mode === 'unlock') {
              // Unlocked to toggle showHidden
              const updated: AppSettings = { ...settings, showHidden: true };
              setSettings(updated);
              await saveSettings(updated);
              onSettingsChanged?.();
            } else {
              setFeedback({ type: 'success', message: 'Vault PIN updated successfully!' });
              await refreshData();
              onSettingsChanged?.();
            }
          }}
        />
      )}
    </>
  );
};
