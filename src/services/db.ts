import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { PdfDocument, PageNote, DocumentGroup, AppSettings } from '../types';

interface PdfFlowDBSchema extends DBSchema {
  documents: {
    key: string;
    value: Omit<PdfDocument, 'pdfData'>;
    indexes: {
      'by-group': string;
      'by-date': number;
      'by-favorite': number;
      'by-hidden': number;
    };
  };
  pdfBlobs: {
    key: string;
    value: { id: string; blob: Blob | ArrayBuffer };
  };
  notes: {
    key: string;
    value: PageNote;
    indexes: {
      'by-doc': string;
      'by-doc-page': [string, number];
      'by-date': number;
    };
  };
  groups: {
    key: string;
    value: DocumentGroup;
    indexes: {
      'by-name': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'PdfFlowMobileDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PdfFlowDBSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PdfFlowDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Document metadata store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by-group', 'groupId');
          docStore.createIndex('by-date', 'dateAdded');
          docStore.createIndex('by-favorite', 'isFavorite');
          docStore.createIndex('by-hidden', 'isHidden');
        }

        // Binary PDF payload store (separated for performance on mobile)
        if (!db.objectStoreNames.contains('pdfBlobs')) {
          db.createObjectStore('pdfBlobs', { keyPath: 'id' });
        }

        // In-page notes store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-doc', 'documentId');
          noteStore.createIndex('by-doc-page', ['documentId', 'pageNumber']);
          noteStore.createIndex('by-date', 'createdAt');
        }

        // Groups store
        if (!db.objectStoreNames.contains('groups')) {
          const groupStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupStore.createIndex('by-name', 'name');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// Initial default groups
export const DEFAULT_GROUPS: DocumentGroup[] = [
  { id: 'work', name: 'Work', color: '#007AFF', icon: 'Briefcase', description: 'Work documents & contracts' },
  { id: 'study', name: 'Study & Books', color: '#34C759', icon: 'GraduationCap', description: 'Academic papers & textbooks' },
  { id: 'finance', name: 'Finance & Bills', color: '#FF9500', icon: 'Receipt', description: 'Receipts, invoices, statements' },
  { id: 'personal', name: 'Personal', color: '#AF52DE', icon: 'User', description: 'Personal reading and records' }
];

export async function initDefaultData() {
  const db = await getDB();
  const count = await db.count('groups');
  if (count === 0) {
    const tx = db.transaction('groups', 'readwrite');
    for (const group of DEFAULT_GROUPS) {
      await tx.store.put(group);
    }
    await tx.done;
  }
}

// Document Operations
export async function saveDocument(doc: PdfDocument, blob?: Blob | ArrayBuffer): Promise<void> {
  const db = await getDB();
  const { pdfData, ...meta } = doc;
  
  const tx = db.transaction(['documents', 'pdfBlobs'], 'readwrite');
  await tx.objectStore('documents').put(meta);
  if (blob) {
    await tx.objectStore('pdfBlobs').put({ id: doc.id, blob });
  } else if (pdfData) {
    await tx.objectStore('pdfBlobs').put({ id: doc.id, blob: pdfData });
  }
  await tx.done;
}

export async function getAllDocuments(): Promise<Omit<PdfDocument, 'pdfData'>[]> {
  const db = await getDB();
  return db.getAll('documents');
}

export async function getDocumentById(id: string): Promise<PdfDocument | null> {
  const db = await getDB();
  const meta = await db.get('documents', id);
  if (!meta) return null;
  const blobEntry = await db.get('pdfBlobs', id);
  return {
    ...meta,
    pdfData: blobEntry?.blob
  };
}

export async function getDocumentBlob(id: string): Promise<Blob | ArrayBuffer | null> {
  const db = await getDB();
  const entry = await db.get('pdfBlobs', id);
  return entry ? entry.blob : null;
}

export async function updateDocumentMeta(id: string, updates: Partial<PdfDocument>): Promise<void> {
  const db = await getDB();
  const current = await db.get('documents', id);
  if (!current) throw new Error(`Document ${id} not found`);
  const updated = { ...current, ...updates };
  delete (updated as any).pdfData;
  await db.put('documents', updated);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'pdfBlobs', 'notes'], 'readwrite');
  await tx.objectStore('documents').delete(id);
  await tx.objectStore('pdfBlobs').delete(id);
  
  // Also delete associated notes
  const notesIndex = tx.objectStore('notes').index('by-doc');
  let cursor = await notesIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// In-Page Notes Operations
export async function saveNote(note: PageNote): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function getNotesForDocument(documentId: string): Promise<PageNote[]> {
  const db = await getDB();
  const index = db.transaction('notes').store.index('by-doc');
  return index.getAll(documentId);
}

export async function getNotesForPage(documentId: string, pageNumber: number): Promise<PageNote[]> {
  const db = await getDB();
  const index = db.transaction('notes').store.index('by-doc-page');
  return index.getAll([documentId, pageNumber]);
}

export async function getAllNotes(): Promise<PageNote[]> {
  const db = await getDB();
  return db.getAll('notes');
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

// Group Operations
export async function getAllGroups(): Promise<DocumentGroup[]> {
  const db = await getDB();
  return db.getAll('groups');
}

export async function saveGroup(group: DocumentGroup): Promise<void> {
  const db = await getDB();
  await db.put('groups', group);
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('groups', id);
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const val = await db.get('settings', 'app_config');
  return val || {
    theme: 'light',
    defaultViewMode: 'grid',
    showHidden: false,
    autoExtractCover: true
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: 'app_config', ...settings });
}
