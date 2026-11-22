import { getDB, getAllDocuments, getAllNotes, getAllGroups, getSettings, saveDocument, saveNote, saveGroup, saveSettings, initDefaultData, DEFAULT_GROUPS } from './db';
import { PdfDocument, PageNote, DocumentGroup, AppSettings } from '../types';

export interface BackupData {
  version: number;
  exportedAt: string;
  settings: AppSettings;
  groups: DocumentGroup[];
  documents: Omit<PdfDocument, 'pdfData'>[];
  notes: PageNote[];
  blobs: Record<string, string>; // documentId -> base64 Data URL
}

/**
 * Converts a Blob or ArrayBuffer to a base64 Data URL
 */
function blobToBase64(blob: Blob | ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const actualBlob = blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(actualBlob);
  });
}

/**
 * Converts a base64 Data URL or string back into a Blob
 */
function base64ToBlob(base64DataUrl: string): Blob {
  const parts = base64DataUrl.split(',');
  const byteString = atob(parts[1] || parts[0]);
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const u8arr = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    u8arr[i] = byteString.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mimeType });
}

/**
 * Exports all user data into a downloadable JSON backup
 */
export async function exportBackup(): Promise<string> {
  const db = await getDB();
  const [documents, notes, groups, settings] = await Promise.all([
    getAllDocuments(),
    getAllNotes(),
    getAllGroups(),
    getSettings(),
  ]);

  const blobs: Record<string, string> = {};
  for (const doc of documents) {
    try {
      const blobEntry = await db.get('pdfBlobs', doc.id);
      if (blobEntry?.blob) {
        blobs[doc.id] = await blobToBase64(blobEntry.blob);
      }
    } catch (err) {
      console.warn(`Could not export blob for document ${doc.id}:`, err);
    }
  }

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    groups,
    documents,
    notes,
    blobs,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Triggers a browser download for the exported backup JSON file
 */
export async function downloadBackup(): Promise<void> {
  const jsonString = await exportBackup();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `pdf-flow-backup-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports backup data from JSON string and updates IndexedDB
 */
export async function importBackup(jsonString: string): Promise<{
  success: boolean;
  docCount: number;
  noteCount: number;
  groupCount: number;
  error?: string;
}> {
  try {
    const data = JSON.parse(jsonString) as BackupData;
    if (!data.version || !data.documents) {
      throw new Error('Invalid backup file format: missing version or documents');
    }

    const db = await getDB();

    // Restore Settings
    if (data.settings) {
      await saveSettings(data.settings);
    }

    // Restore Groups
    let groupCount = 0;
    if (Array.isArray(data.groups)) {
      for (const group of data.groups) {
        await saveGroup(group);
        groupCount++;
      }
    }

    // Restore Documents & Blobs
    let docCount = 0;
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        let blob: Blob | undefined;
        if (data.blobs && data.blobs[doc.id]) {
          blob = base64ToBlob(data.blobs[doc.id]);
        }
        await saveDocument(doc as PdfDocument, blob);
        docCount++;
      }
    }

    // Restore Notes
    let noteCount = 0;
    if (Array.isArray(data.notes)) {
      for (const note of data.notes) {
        await saveNote(note);
        noteCount++;
      }
    }

    return {
      success: true,
      docCount,
      noteCount,
      groupCount,
    };
  } catch (error: any) {
    console.error('Failed to import backup:', error);
    return {
      success: false,
      docCount: 0,
      noteCount: 0,
      groupCount: 0,
      error: error?.message || 'Unknown import error',
    };
  }
}

/**
 * Clears all user documents, blobs, and notes, reset to clean state with default groups
 */
export async function resetAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'pdfBlobs', 'notes', 'groups', 'settings'], 'readwrite');
  await tx.objectStore('documents').clear();
  await tx.objectStore('pdfBlobs').clear();
  await tx.objectStore('notes').clear();
  await tx.objectStore('groups').clear();
  await tx.objectStore('settings').clear();
  await tx.done;

  // Re-seed initial default groups & settings
  await initDefaultData();
  await saveSettings({
    theme: 'light',
    defaultViewMode: 'grid',
    showHidden: false,
    autoExtractCover: true,
  });
}
