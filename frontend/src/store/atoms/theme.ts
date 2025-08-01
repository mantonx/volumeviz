import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { Theme } from '@/types';

/**
 * Persistent theme preference atom.
 */
export const themeAtom = atomWithStorage<Theme>('volumeviz-theme', 'system');

/**
 * Computed resolved theme (light/dark) from preference and system settings.
 */
export const resolvedThemeAtom = atom<'light' | 'dark'>((get) => {
  const theme = get(themeAtom);

  if (theme === 'system') {
    // Check system preference
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light'; // Default for SSR
  }

  return theme;
});

/**
 * Atom for tracking system theme changes
 *
 * This atom can be used to listen for system theme changes and update
 * the UI accordingly when the user has selected 'system' theme.
 */
export const systemThemeAtom = atom<'light' | 'dark'>('light');

// Initialize system theme detection
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Set initial value
  systemThemeAtom.init = mediaQuery.matches ? 'dark' : 'light';

  // Listen for changes
  mediaQuery.addEventListener('change', (e) => {
    // This would need to be handled by a provider or effect
    // systemThemeAtom.write(e.matches ? 'dark' : 'light');
  });
}
