/**
 * Utility functions for formatting dates, file sizes, and gradient styles
 */

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface GradientPreset {
  id: string;
  name: string;
  css: string;
  accent: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'ocean', name: 'Ocean Blue', css: 'from-blue-600 via-indigo-600 to-sky-500', accent: '#2563EB' },
  { id: 'sunset', name: 'Sunset Glow', css: 'from-orange-500 via-amber-500 to-rose-500', accent: '#F97316' },
  { id: 'emerald', name: 'Emerald Mint', css: 'from-emerald-600 via-teal-600 to-cyan-500', accent: '#059669' },
  { id: 'purple', name: 'Royal Amethyst', css: 'from-purple-600 via-violet-600 to-fuchsia-500', accent: '#7C3AED' },
  { id: 'rose', name: 'Rose Petal', css: 'from-rose-500 via-pink-500 to-red-400', accent: '#F43F5E' },
  { id: 'midnight', name: 'Midnight Dark', css: 'from-zinc-800 via-zinc-900 to-black', accent: '#18181B' },
  { id: 'gold', name: 'Golden Sand', css: 'from-amber-600 via-yellow-500 to-orange-400', accent: '#D97706' },
  { id: 'cyber', name: 'Neon Cyber', css: 'from-cyan-500 via-blue-600 to-purple-600', accent: '#06B6D4' }
];

export const NOTE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  yellow: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', dot: '#F59E0B' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-200 dark:border-blue-800', dot: '#3B82F6' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-200 dark:border-emerald-800', dot: '#10B981' },
  pink: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-200 dark:border-rose-800', dot: '#F43F5E' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-200 dark:border-purple-800', dot: '#8B5CF6' }
};
