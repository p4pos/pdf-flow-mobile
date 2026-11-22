import React from 'react';
import {
  BookOpen,
  Sparkles,
  GraduationCap,
  Briefcase,
  Receipt,
  FileText,
  Code,
  Bookmark,
  Lightbulb,
  Heart,
  Compass,
  PenTool,
  Music,
  Coffee,
  Award,
  Folder,
  LucideIcon
} from 'lucide-react';
import { GRADIENT_PRESETS, GradientPreset } from '../../utils/formatters';

export interface CoverIconItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const COVER_ICONS: CoverIconItem[] = [
  { id: 'BookOpen', label: 'Book', icon: BookOpen },
  { id: 'FileText', label: 'Document', icon: FileText },
  { id: 'Sparkles', label: 'Creative', icon: Sparkles },
  { id: 'GraduationCap', label: 'Study', icon: GraduationCap },
  { id: 'Briefcase', label: 'Work', icon: Briefcase },
  { id: 'Receipt', label: 'Finance', icon: Receipt },
  { id: 'Code', label: 'Code', icon: Code },
  { id: 'Bookmark', label: 'Reference', icon: Bookmark },
  { id: 'Lightbulb', label: 'Ideas', icon: Lightbulb },
  { id: 'Heart', label: 'Favorite', icon: Heart },
  { id: 'Compass', label: 'Travel', icon: Compass },
  { id: 'PenTool', label: 'Design', icon: PenTool },
  { id: 'Award', label: 'Certificate', icon: Award },
  { id: 'Coffee', label: 'Personal', icon: Coffee },
  { id: 'Music', label: 'Arts', icon: Music },
  { id: 'Folder', label: 'Archive', icon: Folder },
];

export function getCoverIcon(iconId?: string): LucideIcon {
  if (!iconId) return BookOpen;
  const match = COVER_ICONS.find((item) => item.id.toLowerCase() === iconId.toLowerCase());
  return match ? match.icon : BookOpen;
}

/**
 * Resolves gradient CSS classes given a preset id or css string
 */
export function resolveGradientClass(coverColor?: string): string {
  if (!coverColor) {
    return GRADIENT_PRESETS[0].css; // Ocean Blue default
  }

  // Check if it's a preset ID
  const preset = GRADIENT_PRESETS.find((p) => p.id === coverColor);
  if (preset) return preset.css;

  // If it already contains Tailwind gradient classes
  if (coverColor.includes('from-') || coverColor.includes('to-')) {
    return coverColor;
  }

  return GRADIENT_PRESETS[0].css;
}

export function getGradientPreset(presetIdOrCss?: string): GradientPreset {
  const found = GRADIENT_PRESETS.find(
    (p) => p.id === presetIdOrCss || p.css === presetIdOrCss
  );
  return found || GRADIENT_PRESETS[0];
}
