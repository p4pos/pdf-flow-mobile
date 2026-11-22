import { PdfDocument, PageNote } from '../types';
import { saveDocument, saveNote, getAllDocuments } from './db';
import { createSamplePdf, generateCoverThumbnail } from './pdfService';

export async function seedSampleDataIfEmpty() {
  const existingDocs = await getAllDocuments();
  if (existingDocs.length > 0) return;

  try {
    // 1. Getting Started Guide (Visible, Study group)
    const doc1Id = 'sample-getting-started';
    const blob1 = createSamplePdf(
      'PDF Flow - Getting Started Guide',
      'Your Modern Mobile PDF & Notes Companion',
      3
    );

    const { thumbnailDataUrl } = await generateCoverThumbnail(blob1);

    const doc1: PdfDocument = {
      id: doc1Id,
      title: 'Getting Started with PDF Flow',
      fileName: 'Getting-Started.pdf',
      fileSize: blob1.size,
      pageCount: 3,
      dateAdded: Date.now() - 3600000 * 2,
      coverType: 'page',
      coverData: thumbnailDataUrl,
      groupId: 'study',
      isFavorite: true,
      isHidden: false,
      tags: ['Guide', 'Tutorial'],
    };

    await saveDocument(doc1, blob1);

    // Add sample notes for Document 1
    const note1: PageNote = {
      id: 'note-sample-1',
      documentId: doc1Id,
      pageNumber: 1,
      title: 'Welcome Note',
      content: 'Tap the note icon at the top right of the viewer anytime to read and create notes anchored to this exact page!',
      color: 'yellow',
      createdAt: Date.now() - 3500000,
      updatedAt: Date.now() - 3500000,
    };

    const note2: PageNote = {
      id: 'note-sample-2',
      documentId: doc1Id,
      pageNumber: 2,
      title: 'Customizing Covers & Groups',
      content: 'You can tap the 3 dots (•••) on any card in your library to change the cover to an aesthetic gradient or upload your own photo!',
      color: 'blue',
      createdAt: Date.now() - 3400000,
      updatedAt: Date.now() - 3400000,
    };

    await saveNote(note1);
    await saveNote(note2);

    // 2. Secret Strategy Plan (Hidden Vault sample, Work group)
    const doc2Id = 'sample-confidential-plan';
    const blob2 = createSamplePdf(
      'Confidential Project Strategy',
      'Strategic Planning & Roadmap 2026',
      2
    );

    const doc2: PdfDocument = {
      id: doc2Id,
      title: 'Confidential Strategic Roadmap',
      fileName: 'Project-Strategy-Secret.pdf',
      fileSize: blob2.size,
      pageCount: 2,
      dateAdded: Date.now() - 3600000 * 24,
      coverType: 'gradient',
      coverColor: 'from-purple-600 via-violet-600 to-fuchsia-500',
      groupId: 'work',
      isFavorite: false,
      isHidden: true, // Marked as hidden to demonstrate privacy vault!
      tags: ['Strategy', 'Confidential'],
    };

    await saveDocument(doc2, blob2);

    const note3: PageNote = {
      id: 'note-sample-3',
      documentId: doc2Id,
      pageNumber: 1,
      title: 'Vault Security',
      content: 'This document is hidden from the main library view! Toggle "Hidden" in the top bar to view your private documents.',
      color: 'purple',
      createdAt: Date.now() - 3600000 * 23,
      updatedAt: Date.now() - 3600000 * 23,
    };

    await saveNote(note3);
  } catch (error) {
    console.error('Failed to seed sample data:', error);
  }
}
