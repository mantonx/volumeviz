/**
 * Reusable keyboard shortcuts system
 * Provides a clean, declarative way to define and manage keyboard shortcuts
 */

import React from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: (event: KeyboardEvent) => void;
  category?: string;
  preventDefault?: boolean;
  enabled?: () => boolean;
}

export interface KeyboardShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
  description?: string;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true,
): void {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if focused on input elements
      if (isInputFocused(event.target)) {
        return;
      }

      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled && !shortcut.enabled()) {
          continue;
        }

        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlOrCmd ? cmdOrCtrl : !cmdOrCtrl;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action(event);
          break; // Only trigger first matching shortcut
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Check if an input element is focused
 */
function isInputFocused(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.contentEditable === 'true'
  );
}

/**
 * Create keyboard shortcut configurations for volume list operations
 */
export function createVolumeListShortcuts(actions: {
  selectAll: () => void;
  selectAllAcrossPages: () => void;
  focusSearch: () => void;
  clearSelection: () => void;
  refresh: () => void;
  deleteSelected: () => void;
  toggleQuickFilter: (filterId: string) => void;
  export: () => void;
  openColumnSettings: () => void;
  showHelp?: () => void;
}): KeyboardShortcutGroup[] {
  return [
    {
      name: 'Selection',
      description: 'Select and manage items',
      shortcuts: [
        {
          key: 'a',
          ctrlOrCmd: true,
          description: 'Select all items on current page',
          action: actions.selectAll,
          category: 'selection',
        },
        {
          key: 'a',
          ctrlOrCmd: true,
          shift: true,
          description: 'Select all items across all pages',
          action: actions.selectAllAcrossPages,
          category: 'selection',
        },
        {
          key: 'Escape',
          description: 'Clear selection and close modals',
          action: actions.clearSelection,
          category: 'selection',
        },
      ],
    },
    {
      name: 'Navigation',
      description: 'Navigate and search',
      shortcuts: [
        {
          key: 'f',
          ctrlOrCmd: true,
          description: 'Focus search input',
          action: actions.focusSearch,
          category: 'navigation',
        },
        {
          key: '/',
          description: 'Focus search (alternative)',
          action: actions.focusSearch,
          category: 'navigation',
        },
        {
          key: 'r',
          ctrlOrCmd: true,
          description: 'Refresh data',
          action: actions.refresh,
          category: 'navigation',
        },
      ],
    },
    {
      name: 'Actions',
      description: 'Perform actions on items',
      shortcuts: [
        {
          key: 'Delete',
          description: 'Delete/hide selected items',
          action: actions.deleteSelected,
          category: 'actions',
        },
        {
          key: 'Backspace',
          description: 'Delete/hide selected items (alternative)',
          action: actions.deleteSelected,
          category: 'actions',
        },
        {
          key: 'e',
          ctrlOrCmd: true,
          description: 'Export data',
          action: actions.export,
          category: 'actions',
        },
        {
          key: ',',
          ctrlOrCmd: true,
          description: 'Open column settings',
          action: actions.openColumnSettings,
          category: 'actions',
        },
      ],
    },
    {
      name: 'Quick Filters',
      description: 'Toggle common filters',
      shortcuts: [
        {
          key: '1',
          ctrlOrCmd: true,
          description: 'Toggle orphaned volumes filter',
          action: () => actions.toggleQuickFilter('orphaned'),
          category: 'filters',
        },
        {
          key: '2',
          ctrlOrCmd: true,
          description: 'Toggle untracked volumes filter',
          action: () => actions.toggleQuickFilter('untracked'),
          category: 'filters',
        },
        {
          key: '3',
          ctrlOrCmd: true,
          description: 'Toggle volumes only filter',
          action: () => actions.toggleQuickFilter('volume_type'),
          category: 'filters',
        },
        {
          key: '4',
          ctrlOrCmd: true,
          description: 'Toggle bind mounts filter',
          action: () => actions.toggleQuickFilter('bind_mounts'),
          category: 'filters',
        },
        {
          key: '5',
          ctrlOrCmd: true,
          description: 'Toggle large volumes filter',
          action: () => actions.toggleQuickFilter('large_volumes'),
          category: 'filters',
        },
        {
          key: '6',
          ctrlOrCmd: true,
          description: 'Toggle recently created filter',
          action: () => actions.toggleQuickFilter('recently_created'),
          category: 'filters',
        },
      ],
    },
    {
      name: 'Help',
      description: 'Get help and information',
      shortcuts: actions.showHelp
        ? [
            {
              key: '?',
              description: 'Show keyboard shortcuts help',
              action: actions.showHelp,
              category: 'help',
            },
          ]
        : [],
    },
  ];
}

/**
 * Format shortcut for display (e.g., "Ctrl+A" or "Cmd+A" on Mac)
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrlOrCmd) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format key name
  let keyName = shortcut.key;
  if (keyName === ' ') keyName = 'Space';
  if (keyName === 'Escape') keyName = 'Esc';
  if (keyName === 'Delete') keyName = 'Del';
  if (keyName === 'Backspace') keyName = '⌫';
  if (keyName === '/') keyName = '/';
  if (keyName === '?') keyName = '?';

  parts.push(keyName.toUpperCase());

  return parts.join(isMac ? '' : '+');
}

/**
 * Get all shortcuts as flat array for help display
 */
export function getAllShortcuts(
  groups: KeyboardShortcutGroup[],
): KeyboardShortcut[] {
  return groups.flatMap((group) => group.shortcuts);
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(
  shortcuts: KeyboardShortcut[],
): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>,
  );
}
