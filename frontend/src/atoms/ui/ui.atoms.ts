import { atom } from 'jotai';

// Sidebar state
export const sidebarOpenAtom = atom(true);

// Theme state
export const themeAtom = atom<'light' | 'dark' | 'auto'>('auto');

// Loading states
export const globalLoadingAtom = atom(false);

// Modal states
export const modalOpenAtom = atom<string | null>(null);

// Notification state
export const notificationsAtom = atom<Notification[]>([]);

// Search state
export const globalSearchTermAtom = atom('');

// View preferences
export const viewPreferencesAtom = atom({
  volumeView: 'grid' as 'grid' | 'list',
  fileView: 'list' as 'list' | 'grid' | 'tree',
  showHiddenFiles: false,
  sortOrder: 'asc' as 'asc' | 'desc',
});

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number;
}