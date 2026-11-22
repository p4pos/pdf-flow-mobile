import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  Upload,
  RefreshCw,
  Sparkles,
  FileImage,
  Layers,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { PdfDocument, CoverType } from '../../types';
import { updateDocumentMeta, getDocumentBlob } from '../../services/db';
import { generateCoverThumbnail } from '../../services/pdfService';
import { GRADIENT_PRESETS, GradientPreset } from '../../utils/formatters';
import { COVER_ICONS, getCoverIcon, resolveGradientClass } from './coverIcons';

export interface CoverEditorModalProps {
  isOpen: boolean;
  document: PdfDocument | null;
  onClose: () => void;
  onSave?: (updatedDoc: PdfDocument) => void;
}

export const CoverEditorModal: React.FC<CoverEditorModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<CoverType>('gradient');
  const [pageThumbnail, setPageThumbnail] = useState<string>('');
  const [customImage, setCustomImage] = useState<string>('');
  const [selectedGradient, setSelectedGradient] = useState<string>(GRADIENT_PRESETS[0].id);
  const [selectedIcon, setSelectedIcon] = useState<string>('BookOpen');
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when modal opens or document changes
  useEffect(() => {
    if (!isOpen || !doc) return;

    setActiveTab(doc.coverType || 'gradient');
    setSelectedGradient(doc.coverColor || GRADIENT_PRESETS[0].id);
    setSelectedIcon(doc.coverData && !doc.coverData.startsWith('data:') ? doc.coverData : 'BookOpen');
    setErrorMsg(null);

    if (doc.coverType === 'image' && doc.coverData?.startsWith('data:')) {
      setCustomImage(doc.coverData);
    } else {
      setCustomImage('');
    }

    if (doc.coverType === 'page' && doc.coverData?.startsWith('data:')) {
      setPageThumbnail(doc.coverData);
    } else {
      // Auto-extract page 1 thumbnail if not available
      extractPageThumbnail(doc);
    }
  }, [isOpen, doc]);

  // Extract page 1 thumbnail from PDF blob
  const extractPageThumbnail = async (targetDoc: PdfDocument) => {
    try {
      setIsLoadingThumbnail(true);
      setErrorMsg(null);
      let blob = targetDoc.pdfData;
      if (!blob) {
        blob = (await getDocumentBlob(targetDoc.id)) || undefined;
      }

      if (blob) {
        const { thumbnailDataUrl } = await generateCoverThumbnail(blob, 720);
        if (thumbnailDataUrl) {
          setPageThumbnail(thumbnailDataUrl);
        }
      }
    } catch (err) {
      console.warn('Failed to extract page thumbnail:', err);
    } finally {
      setIsLoadingThumbnail(false);
    }
  };

  if (!isOpen || !doc) return null;

  // Handle image upload from file picker
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      // Compress/resize image on client canvas to keep IndexedDB snappy
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCustomImage(compressedDataUrl);
        } else {
          setCustomImage(result);
        }
        setErrorMsg(null);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Save changes
  const handleSave = async () => {
    if (!doc) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      let finalCoverType: CoverType = activeTab;
      let finalCoverData: string | undefined = undefined;
      let finalCoverColor: string | undefined = undefined;

      if (activeTab === 'page') {
        finalCoverType = 'page';
        finalCoverData = pageThumbnail || doc.coverData;
      } else if (activeTab === 'image') {
        if (!customImage) {
          setErrorMsg('Please select an image first.');
          setIsSaving(false);
          return;
        }
        finalCoverType = 'image';
        finalCoverData = customImage;
      } else if (activeTab === 'gradient') {
        finalCoverType = 'gradient';
        finalCoverColor = selectedGradient;
        finalCoverData = selectedIcon; // Stores chosen icon identifier
      }

      await updateDocumentMeta(doc.id, {
        coverType: finalCoverType,
        coverData: finalCoverData,
        coverColor: finalCoverColor,
      });

      const updated: PdfDocument = {
        ...doc,
        coverType: finalCoverType,
        coverData: finalCoverData,
        coverColor: finalCoverColor,
      };

      onSave?.(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update cover');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute live preview parameters
  const renderLivePreview = () => {
    if (activeTab === 'page' && pageThumbnail) {
      return (
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={pageThumbnail}
            alt="Page 1 preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/35 via-black/10 to-transparent pointer-events-none" />
        </div>
      );
    }

    if (activeTab === 'image' && customImage) {
      return (
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={customImage}
            alt="Custom cover preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/35 via-black/10 to-transparent pointer-events-none" />
        </div>
      );
    }

    // Gradient cover
    const gradientClass = resolveGradientClass(selectedGradient);
    const IconComp = getCoverIcon(selectedIcon);

    return (
      <div
        className={`relative w-full h-full bg-gradient-to-br ${gradientClass} p-3.5 flex flex-col justify-between text-white overflow-hidden shadow-inner`}
      >
        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" />
        <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/20 rounded-full blur-lg pointer-events-none" />

        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-sm">
            <IconComp className="w-5 h-5" />
          </div>
        </div>

        <div className="relative z-10">
          <h5 className="font-bold text-xs font-serif leading-tight line-clamp-3 drop-shadow-sm">
            {doc.title}
          </h5>
          <p className="text-[10px] text-white/80 font-medium mt-1">
            {doc.pageCount} pages
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      {/* Background touch dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Sheet Modal Container */}
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden transition-transform animate-in slide-in-from-bottom duration-250">
        {/* iOS Pull / Drag Indicator */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Cover & Appearance
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate max-w-[280px]">
              {doc.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {errorMsg}
            </div>
          )}

          {/* Live Mobile Card Preview */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              Live Preview
            </span>
            <div className="relative w-32 h-44 rounded-xl overflow-hidden shadow-xl ring-1 ring-black/10 dark:ring-white/10">
              {renderLivePreview()}
            </div>
          </div>

          {/* 3 Tab Switcher */}
          <div className="grid grid-cols-3 p-1 bg-gray-100 dark:bg-zinc-800 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('page')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
                activeTab === 'page'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
              }`}
            >
              <FileImage className="w-4 h-4" />
              <span>Page 1</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
                activeTab === 'image'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gradient')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all ${
                activeTab === 'gradient'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Gradient</span>
            </button>
          </div>

          {/* TAB 1: Page 1 Thumbnail */}
          {activeTab === 'page' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    PDF First Page
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Use the auto-rendered cover from the document's first page
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isLoadingThumbnail}
                  onClick={() => extractPageThumbnail(doc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingThumbnail ? 'animate-spin' : ''}`}
                  />
                  <span>Rerender</span>
                </button>
              </div>

              {pageThumbnail ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800">
                  <img
                    src={pageThumbnail}
                    alt="First page"
                    className="w-14 h-20 object-cover rounded-md shadow-sm border border-gray-200 dark:border-zinc-700"
                  />
                  <div className="text-xs text-gray-600 dark:text-zinc-300">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Page 1 extracted successfully
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      Sharp high-res preview rendered from vector PDF content.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                  {isLoadingThumbnail ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-xs text-gray-500">
                        Generating cover preview...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileImage className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
                      <span className="text-xs text-gray-500">
                        No thumbnail extracted yet. Tap Rerender to generate.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Upload Custom Image */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl cursor-pointer text-center transition-all bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Choose picture from gallery
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Supports PNG, JPG, or WebP
                  </p>
                </div>
              </div>

              {customImage && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <img
                      src={customImage}
                      alt="Uploaded cover"
                      className="w-14 h-20 object-cover rounded-md shadow-sm"
                    />
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        Selected Custom Image
                      </span>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready to apply
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomImage('')}
                    className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Aesthetic Gradient Themes */}
          {activeTab === 'gradient' && (
            <div className="space-y-5">
              {/* Theme Swatches */}
              <div>
                <label className="text-xs font-semibold text-gray-900 dark:text-white block mb-2">
                  1. Choose Gradient Colorway
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected =
                      selectedGradient === preset.id || selectedGradient === preset.css;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedGradient(preset.id)}
                        className={`group relative h-14 rounded-xl bg-gradient-to-br ${preset.css} p-1 text-left flex flex-col justify-end overflow-hidden shadow-sm transition-all active:scale-95 ${
                          isSelected
                            ? 'ring-2 ring-blue-600 dark:ring-white scale-105 shadow-md'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-white text-blue-600 rounded-full flex items-center justify-center shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-white tracking-tight drop-shadow-sm truncate px-1">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-900 dark:text-white block mb-2">
                  2. Choose Cover Icon
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {COVER_ICONS.map((item) => {
                    const isSelected = selectedIcon === item.id;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedIcon(item.id)}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-300'
                            : 'border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-[10px] font-medium leading-none">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900 flex items-center justify-end gap-3 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Cover</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
