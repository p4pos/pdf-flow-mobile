import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  BookOpen, 
  Lock, 
  ArrowRight,
  Folder
} from 'lucide-react';
import { 
  PdfDocument, 
  DocumentGroup, 
  AppSettings, 
  ViewMode, 
  VisibilityFilter, 
  ReaderTheme 
} from './types';
import { 
  getAllDocuments, 
  getDocumentById, 
  getAllGroups, 
  getSettings, 
  updateDocumentMeta, 
  deleteDocument, 
  getAllNotes,
  initDefaultData 
} from './services/db';
import { seedSampleDataIfEmpty } from './services/sampleData';
import { Header } from './components/common/Header';
import { TabBar, TabType } from './components/common/TabBar';
import { GroupChips } from './components/common/GroupChips';
import { ToastProvider, useToast } from './components/common/Toast';
import { DocumentCard } from './components/library/DocumentCard';
import { DocumentMenuModal } from './components/library/DocumentMenuModal';
import { CoverEditorModal } from './components/library/CoverEditorModal';
import { RenameModal } from './components/library/RenameModal';
import { NotesPreviewModal } from './components/library/NotesPreviewModal';
import { ChangeGroupModal } from './components/library/ChangeGroupModal';
import { PdfViewerModal } from './components/viewer/PdfViewerModal';
import { FileUploadModal } from './components/upload/FileUploadModal';
import { GroupManagerModal } from './components/groups/GroupManagerModal';
import { PinLockModal } from './components/privacy/PinLockModal';
import { AllNotesView } from './components/notes/AllNotesView';
import { SettingsModal } from './components/settings/SettingsModal';

function MainAppContent() {
  const { success, error, info, vault } = useToast();

  // Core Data State
  const [documents, setDocuments] = useState<Omit<PdfDocument, 'pdfData'>[]>([]);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    defaultViewMode: 'grid',
    showHidden: false,
    autoExtractCover: true,
  });
  const [notesCountMap, setNotesCountMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Navigation & View Filters
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);

  // Active Modals & Viewers
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [viewerDoc, setViewerDoc] = useState<PdfDocument | null>(null);
  const [viewerInitialPage, setViewerInitialPage] = useState<number>(1);

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Contextual Document Actions
  const [selectedDoc, setSelectedDoc] = useState<PdfDocument | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCoverEditorOpen, setIsCoverEditorOpen] = useState<boolean>(false);
  const [isRenameOpen, setIsRenameOpen] = useState<boolean>(false);
  const [isNotesPreviewOpen, setIsNotesPreviewOpen] = useState<boolean>(false);
  const [isChangeGroupOpen, setIsChangeGroupOpen] = useState<boolean>(false);

  // Privacy PIN Modal
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<'unlock' | 'set' | 'change'>('unlock');

  // Load All Data
  const loadData = useCallback(async () => {
    try {
      await initDefaultData();
      await seedSampleDataIfEmpty();

      const [loadedSettings, loadedGroups, loadedDocs, loadedNotes] = await Promise.all([
        getSettings(),
        getAllGroups(),
        getAllDocuments(),
        getAllNotes(),
      ]);

      setSettings(loadedSettings);
      setViewMode(loadedSettings.defaultViewMode);
      setGroups(loadedGroups);
      setDocuments(loadedDocs);

      // Compute notes count per document
      const counts: Record<string, number> = {};
      for (const note of loadedNotes) {
        counts[note.documentId] = (counts[note.documentId] || 0) + 1;
      }
      setNotesCountMap(counts);

      // Apply theme
      applyTheme(loadedSettings.theme);
    } catch (err) {
      console.error('Failed to load application data:', err);
      error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyTheme = (theme: ReaderTheme) => {
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
  };

  // Open PDF Viewer
  const handleOpenDocument = async (docId: string, initialPage: number = 1) => {
    try {
      const fullDoc = await getDocumentById(docId);
      if (!fullDoc) {
        error('Document could not be opened');
        return;
      }

      // Update lastOpened
      await updateDocumentMeta(docId, { lastOpened: Date.now() });

      setViewerDoc(fullDoc);
      setViewerInitialPage(initialPage);
      setIsViewerOpen(true);
    } catch (err) {
      console.error('Failed to open document:', err);
      error('Could not render PDF');
    }
  };

  // Handle Visibility Filter Cycling
  const handleVisibilityFilterChange = (filter: VisibilityFilter) => {
    if (filter === 'hidden') {
      // If PIN is set and vault not yet unlocked, require PIN
      if (settings.pinCode && !isVaultUnlocked) {
        setPinModalMode('unlock');
        setIsPinModalOpen(true);
        return;
      }
    }
    setVisibilityFilter(filter);
  };

  // Toggle Favorite
  const handleToggleFavorite = async (doc: PdfDocument | Omit<PdfDocument, 'pdfData'>) => {
    try {
      const updatedFav = !doc.isFavorite;
      await updateDocumentMeta(doc.id, { isFavorite: updatedFav });
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, isFavorite: updatedFav } : d));
      success(updatedFav ? `Favorited "${doc.title}"` : `Removed "${doc.title}" from favorites`);
    } catch (err) {
      error('Could not update favorites');
    }
  };

  // Toggle Favorite by Id (for Viewer)
  const handleToggleFavoriteById = async (docId: string, isFav: boolean) => {
    try {
      await updateDocumentMeta(docId, { isFavorite: isFav });
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isFavorite: isFav } : d));
      if (viewerDoc && viewerDoc.id === docId) {
        setViewerDoc({ ...viewerDoc, isFavorite: isFav });
      }
      success(isFav ? 'Added to favorites' : 'Removed from favorites');
    } catch (err) {
      error('Could not update favorites');
    }
  };

  // Toggle Hidden / Vault Status
  const handleToggleHidden = async (doc: PdfDocument | Omit<PdfDocument, 'pdfData'>) => {
    try {
      const updatedHidden = !doc.isHidden;
      await updateDocumentMeta(doc.id, { isHidden: updatedHidden });
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, isHidden: updatedHidden } : d));
      vault(updatedHidden ? `"${doc.title}" moved to Secret Vault` : `"${doc.title}" restored to Library`);
    } catch (err) {
      error('Could not update vault status');
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      info('Document and notes removed');
    } catch (err) {
      error('Could not delete document');
    }
  };

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesFile = doc.fileName.toLowerCase().includes(query);
        const matchesTags = doc.tags?.some(t => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesFile && !matchesTags) return false;
      }

      // Group Filter
      if (selectedGroupId && doc.groupId !== selectedGroupId) {
        return false;
      }

      // Favorites Tab
      if (activeTab === 'favorites' && !doc.isFavorite) {
        return false;
      }

      // Visibility Filter
      if (visibilityFilter === 'visible' && doc.isHidden) {
        return false;
      }
      if (visibilityFilter === 'hidden') {
        if (!doc.isHidden) return false;
        if (settings.pinCode && !isVaultUnlocked) return false;
      }
      if (visibilityFilter === 'all') {
        // If hidden and settings don't show hidden, exclude unless unlocked
        if (doc.isHidden && !settings.showHidden && !isVaultUnlocked) {
          return false;
        }
      }

      return true;
    });
  }, [documents, searchQuery, selectedGroupId, activeTab, visibilityFilter, isVaultUnlocked, settings.showHidden, settings.pinCode]);

  // Statistics
  const totalHiddenCount = useMemo(() => documents.filter(d => d.isHidden).length, [documents]);
  const totalFavoritesCount = useMemo(() => documents.filter(d => d.isFavorite).length, [documents]);
  const totalNotesCount = useMemo(() => Object.values(notesCountMap).reduce((a, b) => a + b, 0), [notesCountMap]);

  // Group counts map
  const groupCountsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      if (doc.groupId) {
        counts[doc.groupId] = (counts[doc.groupId] || 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  return (
    <div className="min-h-screen bg-ios-bg dark:bg-ios-darkBg text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <Header
        title="PDF Flow"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
        visibilityFilter={visibilityFilter}
        onVisibilityFilterChange={handleVisibilityFilterChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hiddenCount={totalHiddenCount}
        totalCount={documents.length}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-24">
        {/* TAB 1: LIBRARY & FAVORITES */}
        {(activeTab === 'library' || activeTab === 'favorites') && (
          <div>
            {/* Horizontal Group Chips */}
            <GroupChips
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              totalCount={documents.length}
              groupCounts={groupCountsMap}
              onAddGroup={() => setIsGroupManagerOpen(true)}
            />

            {/* Content Area */}
            <div className="px-4 py-2">
              {/* Vault Warning if Hidden Filter Active */}
              {visibilityFilter === 'hidden' && (
                <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span><strong>Vault Mode:</strong> Viewing hidden & protected PDFs</span>
                  </div>
                  <button
                    onClick={() => setVisibilityFilter('all')}
                    className="font-bold underline text-[11px] ml-2"
                  >
                    Exit Vault
                  </button>
                </div>
              )}

              {/* Documents Grid / List */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">Loading library...</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200">
                      {searchQuery
                        ? 'No matching PDFs found'
                        : activeTab === 'favorites'
                        ? 'No favorites yet'
                        : selectedGroupId
                        ? 'No documents in this group'
                        : visibilityFilter === 'hidden'
                        ? 'No hidden documents in vault'
                        : 'Your library is empty'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                      {searchQuery
                        ? 'Try searching by a different name, file, or tag.'
                        : activeTab === 'favorites'
                        ? 'Tap the heart icon on any PDF card to pin it here.'
                        : 'Import or drag & drop PDF files to start reading, customizing covers, and taking notes.'}
                    </p>
                  </div>

                  {!searchQuery && (
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(true)}
                      className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First PDF</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5'
                      : 'space-y-2.5'
                  }
                >
                  {filteredDocuments.map(doc => {
                    const group = groups.find(g => g.id === doc.groupId);
                    return (
                      <DocumentCard
                        key={doc.id}
                        document={doc as PdfDocument}
                        viewMode={viewMode}
                        group={group}
                        notesCount={notesCountMap[doc.id] || 0}
                        onOpen={d => handleOpenDocument(d.id, 1)}
                        onMenuClick={(d, e) => {
                          e.stopPropagation();
                          setSelectedDoc(d);
                          setIsMenuOpen(true);
                        }}
                        onPreviewNotes={(d, e) => {
                          e.stopPropagation();
                          setSelectedDoc(d);
                          setIsNotesPreviewOpen(true);
                        }}
                        onToggleFavorite={(d, e) => {
                          e.stopPropagation();
                          handleToggleFavorite(d);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ALL NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="px-4 py-3">
            <AllNotesView
              onOpenDocument={(docId, pageNum) => handleOpenDocument(docId, pageNum)}
              activeTab={activeTab}
            />
          </div>
        )}

        {/* TAB 3: GROUPS TAB */}
        {activeTab === 'groups' && (
          <div className="px-4 py-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Document Groups
                </h2>
                <p className="text-xs text-gray-500">
                  Organize documents into color-coded categories
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupManagerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Group</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map(group => {
                const count = documents.filter(d => d.groupId === group.id).length;
                return (
                  <div
                    key={group.id}
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setActiveTab('library');
                    }}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-xs"
                        style={{ backgroundColor: group.color }}
                      >
                        <Folder className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {group.name}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {count} {count === 1 ? 'document' : 'documents'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (M3 FAB) for Adding PDFs */}
      {activeTab === 'library' && (
        <button
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="fixed right-5 bottom-20 z-40 w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-90 text-white shadow-m3-fab flex items-center justify-center transition-all duration-200 group"
          aria-label="Add PDF Document"
        >
          <Plus className="w-6 h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
        </button>
      )}

      {/* Bottom Docked Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab);
          if (tab === 'library') setSelectedGroupId(null);
        }}
        badgeCounts={{
          favorites: totalFavoritesCount,
          notes: totalNotesCount,
        }}
      />

      {/* MODAL 1: Fullscreen PDF Viewer & In-Page Notes */}
      {isViewerOpen && viewerDoc && (
        <PdfViewerModal
          isOpen={isViewerOpen}
          document={viewerDoc}
          initialPage={viewerInitialPage}
          initialTheme={settings.theme}
          onClose={() => {
            setIsViewerOpen(false);
            setViewerDoc(null);
            loadData();
          }}
          onToggleFavorite={(docId, isFav) => {
            handleToggleFavoriteById(docId, isFav);
          }}
          onDocumentUpdate={updated => {
            setViewerDoc(updated);
            loadData();
          }}
        />
      )}

      {/* MODAL 2: Document Action Sheet Menu */}
      {selectedDoc && (
        <DocumentMenuModal
          isOpen={isMenuOpen}
          document={selectedDoc}
          onClose={() => {
            setIsMenuOpen(false);
            setSelectedDoc(null);
          }}
          onRename={d => {
            setSelectedDoc(d);
            setIsMenuOpen(false);
            setIsRenameOpen(true);
          }}
          onEditCover={d => {
            setSelectedDoc(d);
            setIsMenuOpen(false);
            setIsCoverEditorOpen(true);
          }}
          onChangeGroup={d => {
            setSelectedDoc(d);
            setIsMenuOpen(false);
            setIsChangeGroupOpen(true);
          }}
          onToggleFavorite={d => {
            handleToggleFavorite(d);
            setIsMenuOpen(false);
          }}
          onToggleVisibility={d => {
            handleToggleHidden(d);
            setIsMenuOpen(false);
          }}
          onDelete={d => {
            handleDeleteDocument(d.id);
            setIsMenuOpen(false);
            setSelectedDoc(null);
          }}
          onDocumentUpdated={d => {
            loadData();
          }}
        />
      )}

      {/* MODAL 3: Cover Editor Modal */}
      {selectedDoc && isCoverEditorOpen && (
        <CoverEditorModal
          isOpen={isCoverEditorOpen}
          document={selectedDoc}
          onClose={() => {
            setIsCoverEditorOpen(false);
            setSelectedDoc(null);
          }}
          onSave={() => {
            setIsCoverEditorOpen(false);
            setSelectedDoc(null);
            loadData();
            success('New cover design saved!');
          }}
        />
      )}

      {/* MODAL 4: Rename & Tags Modal */}
      {selectedDoc && isRenameOpen && (
        <RenameModal
          isOpen={isRenameOpen}
          document={selectedDoc}
          onClose={() => {
            setIsRenameOpen(false);
            setSelectedDoc(null);
          }}
          onDocumentUpdated={() => {
            setIsRenameOpen(false);
            setSelectedDoc(null);
            loadData();
            success('Document renamed');
          }}
        />
      )}

      {/* MODAL 5: Change Group Modal */}
      {selectedDoc && isChangeGroupOpen && (
        <ChangeGroupModal
          isOpen={isChangeGroupOpen}
          document={selectedDoc}
          onClose={() => {
            setIsChangeGroupOpen(false);
            setSelectedDoc(null);
          }}
          onDocumentUpdated={() => {
            setIsChangeGroupOpen(false);
            setSelectedDoc(null);
            loadData();
            success('Group updated');
          }}
        />
      )}

      {/* MODAL 6: Notes Preview Modal */}
      {selectedDoc && isNotesPreviewOpen && (
        <NotesPreviewModal
          isOpen={isNotesPreviewOpen}
          document={selectedDoc}
          onClose={() => {
            setIsNotesPreviewOpen(false);
            setSelectedDoc(null);
          }}
          onNavigateToPage={(doc, page) => {
            setIsNotesPreviewOpen(false);
            handleOpenDocument(doc.id, page);
          }}
        />
      )}

      {/* MODAL 7: File Upload Sheet */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        defaultGroupId={selectedGroupId || undefined}
        onDocumentAdded={async docId => {
          setIsUploadOpen(false);
          await loadData();
          success('Added to your library');
        }}
      />

      {/* MODAL 8: Group Manager Modal */}
      <GroupManagerModal
        isOpen={isGroupManagerOpen}
        onClose={() => {
          setIsGroupManagerOpen(false);
          loadData();
        }}
        onGroupsChanged={loadData}
      />

      {/* MODAL 9: Settings & Vault Security Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChanged={loadData}
      />

      {/* MODAL 10: PIN Lock Modal for Hidden Vault */}
      <PinLockModal
        isOpen={isPinModalOpen}
        mode={pinModalMode}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => {
          setIsPinModalOpen(false);
          setIsVaultUnlocked(true);
          setVisibilityFilter('hidden');
          vault('Secret documents are now visible');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
}
