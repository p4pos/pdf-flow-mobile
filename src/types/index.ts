export type CoverType = 'page' | 'image' | 'gradient';

export type ReaderTheme = 'light' | 'dark' | 'sepia';

export type ViewMode = 'grid' | 'list';

export type VisibilityFilter = 'all' | 'visible' | 'hidden';

export interface PdfDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  dateAdded: number;
  lastOpened?: number;
  coverType: CoverType;
  coverData?: string; // Data URL for image/page thumbnail, or gradient identifier
  coverColor?: string; // Accent color or gradient class (e.g. 'from-blue-600 to-indigo-600')
  groupId?: string;
  isFavorite: boolean;
  isHidden: boolean;
  tags?: string[];
  pdfData?: ArrayBuffer | Blob; // Stored in IndexedDB
}

export interface PageNote {
  id: string;
  documentId: string;
  pageNumber: number;
  title?: string;
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  createdAt: number;
  updatedAt: number;
}

export interface DocumentGroup {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  isHidden?: boolean;
}

export interface AppSettings {
  theme: ReaderTheme;
  defaultViewMode: ViewMode;
  showHidden: boolean;
  pinCode?: string; // Optional security PIN for hidden PDFs
  autoExtractCover: boolean;
}
