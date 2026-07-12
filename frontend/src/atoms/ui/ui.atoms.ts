import { atom } from 'jotai';

// Sidebar state
export const sidebarOpenAtom = atom(true);

// Theme state moved to @/atoms/theme/theme.atoms.ts
// Import from @/store or @/atoms/theme instead

// Loading states
export const globalLoadingAtom = atom(false);

// Modal states
export const modalOpenAtom = atom<string | null>(null);

// Notification state — recently-shown error/warning toasts, kept around
// after the toast itself auto-dismisses so NotificationsDropdown has
// something durable to show for failures that never reach the backend at
// all (e.g. a 401 before a scan job is even created has no server-side
// scan-error row to query — see NotificationsDropdown.tsx). Capped at
// MAX_NOTIFICATIONS most recent; populated by ToastProvider's error/warning
// helpers, not written to directly by feature code.
export const notificationsAtom = atom<Notification[]>([]);

const MAX_NOTIFICATIONS = 10;

export const addNotificationAtom = atom(
  null,
  (get, set, notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const current = get(notificationsAtom);
    const next: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    set(notificationsAtom, [next, ...current].slice(0, MAX_NOTIFICATIONS));
  },
);

// Search state
export const globalSearchTermAtom = atom('');

// View preferences
export const viewPreferencesAtom = atom({
  volumeView: 'grid' as 'grid' | 'list',
  fileView: 'list' as 'list' | 'grid' | 'tree',
  showHiddenFiles: false,
  sortOrder: 'asc' as 'asc' | 'desc',
});

// Derived atom for volumes view mode specifically
export const volumesViewModeAtom = atom(
  (get) => get(viewPreferencesAtom).volumeView,
  (get, set, newViewMode: 'grid' | 'list') => {
    const currentPrefs = get(viewPreferencesAtom);
    set(viewPreferencesAtom, {
      ...currentPrefs,
      volumeView: newViewMode,
    });
  },
);

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number;
}
